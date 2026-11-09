import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reference = process.argv[2];
if (!reference) throw new Error("Usage: node tests/visual/capture.mjs /path/to/prepared-reference");
const require = createRequire(path.join(reference, "package.json"));
const { PNG } = await import(pathToFileURL(require.resolve("pngjs")).href);
const { default: pixelmatch } = await import(pathToFileURL(require.resolve("pixelmatch")).href);
import { readFile, writeFile, mkdir } from "node:fs/promises";
const inventory = JSON.parse(
	await readFile(path.join(root, "tests/fixtures/upstream-parity.json"), "utf8")
);
const names = process.env.COMPONENTS?.split(",") ?? [
	...inventory.ui,
	...inventory.blocks.map((n) => "block-" + n),
	"voice-picker-open",
	"mic-selector-open",
];
const out = process.env.VISUAL_OUTPUT ?? path.join(root, "test-results/visual");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
	args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const rows = [];
for (const [viewport, width] of [
	["desktop", 1280],
	["mobile", 390],
].filter(([name]) => !process.env.VIEWPORT || process.env.VIEWPORT === name))
	for (const theme of ["light", "dark"].filter(
		(name) => !process.env.THEME || process.env.THEME === name
	)) {
		const context = await browser.newContext({
			viewport: { width, height: 900 },
			deviceScaleFactor: 1,
			permissions: ["microphone"],
			colorScheme: theme,
		});
		await context.route("**/*perlin-noise.png", (route) =>
			route.fulfill({
				path: path.join(root, "static/orbs/perlin-noise.png"),
				contentType: "image/png",
			})
		);
		await context.route("**/audio/transcript-viewer.wav", (route) =>
			route.fulfill({
				path: path.join(root, "static/audio/transcript-viewer.wav"),
				contentType: "audio/wav",
			})
		);
		await context.route("https://elevenlabs.io/docs", (route) =>
			route.fulfill({
				contentType: "text/html",
				body: '<html><body style="margin:0;background:#fff;color:#111;padding:24px;font:16px sans-serif">Documentation preview</body></html>',
			})
		);
		for (const name of names) {
			const expanded = name.endsWith("-open");
			const component = expanded ? name.slice(0, -5) : name;
			const results = [];
			for (const [label, port] of [
				["react", 4176],
				["svelte", 4174],
			]) {
				const page = await context.newPage();
				const errors = [];
				page.on("pageerror", (e) => errors.push(e.message));
				try {
					await page.goto(
						`http://127.0.0.1:${port}/?scenario=visual&component=${component}&theme=${theme}`,
						{ waitUntil: "load", timeout: 20000 }
					);
					await page.locator('[data-testid="visual-stage"]').waitFor({ timeout: 10000 });
					await page.evaluate(() => document.fonts.ready);
					if (expanded) {
						await page.locator('[data-testid="visual-stage"] button').first().click();
						await page
							.locator('[data-slot="popover-content"], [data-slot="dropdown-menu-content"]')
							.waitFor();
					}
					await page.waitForTimeout(900);
					await page.evaluate(async () => {
						for (const animation of document.getAnimations()) {
							if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish();
						}
						await new Promise(requestAnimationFrame);
						await new Promise(requestAnimationFrame);
					});
					const stage = page.locator('[data-testid="visual-stage"]');
					const metrics = await stage.evaluate((el) => ({
						width: el.getBoundingClientRect().width,
						height: el.getBoundingClientRect().height,
						overflow: document.documentElement.scrollWidth > innerWidth,
						text: el.textContent?.trim(),
						bg: getComputedStyle(document.body).backgroundColor,
						buttons: [...el.querySelectorAll("button")].map((b) => ({
							text: b.textContent?.trim(),
							width: b.getBoundingClientRect().width,
							height: b.getBoundingClientRect().height,
						})),
					}));
					const file = `${name}-${viewport}-${theme}-${label}.png`;
					await page.screenshot({
						path: `${out}/${file}`,
						...(expanded ? { fullPage: true } : { clip: await stage.boundingBox() }),
						caret: "initial",
						timeout: 10000,
					});
					results.push({ label, file, metrics, errors });
				} catch (e) {
					results.push({ label, error: e.message, errors });
				}
				await page.close();
			}
			const row = { name, viewport, theme, results };
			if (results.every((r) => r.file)) {
				const [a, b] = await Promise.all(
					results.map(async (r) => PNG.sync.read(await readFile(`${out}/${r.file}`)))
				);
				const width = Math.max(a.width, b.width),
					height = Math.max(a.height, b.height);
				const pad = (src) => {
					const png = new PNG({ width, height });
					png.data.fill(theme === "dark" ? 16 : 255);
					for (let y = 0; y < height; y++)
						for (let x = 0; x < width; x++) png.data[(y * width + x) * 4 + 3] = 255;
					PNG.bitblt(src, png, 0, 0, src.width, src.height, 0, 0);
					return png;
				};
				const diff = new PNG({ width, height });
				const mismatch = pixelmatch(pad(a).data, pad(b).data, diff.data, width, height, {
					threshold: 0.12,
				});
				row.diffPercent = Number(((100 * mismatch) / (width * height)).toFixed(2));
				row.sameSize = a.width === b.width && a.height === b.height;
				row.diff = `${name}-${viewport}-${theme}-diff.png`;
				await writeFile(`${out}/${row.diff}`, PNG.sync.write(diff));
			}
			rows.push(row);
			console.log(
				name,
				viewport,
				theme,
				row.diffPercent ?? "ERROR",
				results
					.map((r) => r.error || r.errors.join("; "))
					.filter(Boolean)
					.join(" | ")
			);
		}
		await context.close();
	}
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(rows, null, 2));
await writeFile(
	`${out}/index.html`,
	`<!doctype html><html><head><meta charset="utf-8"><title>sv11 visual parity</title><style>body{font:14px system-ui;margin:20px}section{margin-bottom:32px}article{display:flex;align-items:flex-start;gap:16px;overflow:auto}figure{margin:0}img{max-width:768px;border:1px solid #ddd}pre{white-space:pre-wrap}</style></head><body><h1>sv11 UI / pinned ElevenLabs UI comparison</h1><p>Reference ${inventory.revision}. Same font, inputs, viewport and shared light/dark tokens. Animated canvases and timers are not synchronized; percentages are diagnostic, not pass/fail.</p>${rows.map((row) => `<section><h2>${row.name} · ${row.viewport} · ${row.theme} · ${row.diffPercent ?? "unavailable"}% different</h2><article>${row.results.map((r) => `<figure><figcaption>${r.label}</figcaption>${r.file ? `<img src="${r.file}">` : `<pre>${r.error}</pre>`}</figure>`).join("")}${row.diff ? `<figure><figcaption>Difference</figcaption><img src="${row.diff}"></figure>` : ""}</article></section>`).join("")}</body></html>`
);

if (rows.some((row) => row.results.some((result) => result.error || result.errors?.length))) {
	process.exitCode = 1;
}
