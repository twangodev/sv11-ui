import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ page }) => {
	await page.route("https://sv11.ui.twango.dev/orbs/perlin-noise.png", (route) =>
		route.fulfill({ contentType: "image/png", body: readFileSync("static/orbs/perlin-noise.png") })
	);
});

test("one shared session drives all layouts and survives an individual control unmount", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/?scenario=chat");
	await page.getByRole("button", { name: "Start voice call" }).click();
	await expect(page.getByTestId("status")).toHaveText("connected");
	await page.getByPlaceholder("Type a message...").fill("test turn");
	await page.getByRole("button", { name: "Send message", exact: true }).first().click();
	await expect(page.getByText("A: test turn", { exact: true })).toHaveCount(2);
	await expect(page.getByText("A: partial", { exact: true })).toHaveCount(0);
	await expect(page.getByTestId("counts")).toHaveText("1:0:A");
	await page.getByRole("button", { name: "Toggle mute", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Unmute microphone", exact: true })
	).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Toggle card" }).click();
	await expect(page.getByTestId("status")).toHaveText("connected");
	await expect(page.getByTestId("counts")).toHaveText("1:0:A");
	await page.getByRole("button", { name: "Switch backend" }).click();
	await page.getByRole("button", { name: "Start conversation", exact: true }).click();
	await page.getByRole("button", { name: "Open text input" }).click();
	await page.getByPlaceholder("Enter your message...").fill("other provider");
	await page.getByRole("button", { name: "Send message", exact: true }).click();
	await expect(page.getByText("B: other provider", { exact: true })).toBeVisible();
	await expect(page.getByTestId("counts")).toHaveText("2:1:B");
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	expect(errors).toEqual([]);
	await page.screenshot({ path: test.info().outputPath("shared-session.png"), fullPage: true });
});

test("speech input stop waits for a finalized transcript", async ({ page }) => {
	await page.goto("/?scenario=speech");
	await page.getByRole("button", { name: "Start recording", exact: true }).click();
	await page.getByRole("button", { name: "Stop recording", exact: true }).click();
	await expect(page.getByTestId("stopped")).toHaveText("hello finalized");
});

test("realtime transcriber preserves the final phrase on stop", async ({ page }) => {
	await page.goto("/?scenario=realtime");
	await page.getByRole("button", { name: /Start/ }).click();
	await page.getByRole("button", { name: /Stop/ }).click();
	await expect(page.getByText("hello finalized", { exact: true })).toBeVisible();
});

test("voice form records once and preserves fields absent from extraction", async ({ page }) => {
	await page.addInitScript(() => {
		const media = navigator.mediaDevices,
			original = media.getUserMedia.bind(media);
		Object.assign(window, { microphoneRequests: 0 });
		media.getUserMedia = (constraints) => {
			(window as unknown as { microphoneRequests: number }).microphoneRequests++;
			return original(constraints);
		};
	});
	await page.goto("/?scenario=form");
	await page.getByRole("button", { name: "Voice Button", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => (window as unknown as { microphoneRequests: number }).microphoneRequests)
		)
		.toBe(1);
	await page.waitForTimeout(150);
	await page.getByRole("button", { name: "Voice Button", exact: true }).click();
	await expect(page.getByTestId("values")).toHaveText(
		'{"firstName":"Grace","lastName":"Existing"}'
	);
	expect(
		await page.evaluate(
			() => (window as unknown as { microphoneRequests: number }).microphoneRequests
		)
	).toBe(1);
});

test("voice navigation uses the injected transcription and intent resolver", async ({ page }) => {
	// Keep the destination preview from recursively mounting the fixture application.
	await page.route("**/destination", (route) =>
		route.fulfill({ contentType: "text/html", body: "<h1>Destination</h1>" })
	);
	await page.route("http://127.0.0.1:4174/", (route) =>
		route.fulfill({ contentType: "text/html", body: "<h1>Start</h1>" })
	);
	await page.goto("/?scenario=navigation");
	await page.getByRole("button", { name: "Voice Button", exact: true }).click();
	await page.waitForTimeout(150);
	await page.getByRole("button", { name: "Voice Button", exact: true }).click();
	await expect(page.locator("iframe")).toHaveAttribute("src", "/destination");
});

test("recorded transcription uses the injected task and retains its result", async ({ page }) => {
	await page.goto("/?scenario=transcriber");
	await page.getByRole("button", { name: "Start recording", exact: true }).click();
	await page.waitForTimeout(150);
	await page.getByRole("button", { name: "Stop recording", exact: true }).click();
	await expect(page.getByText("recorded audio transcribed", { exact: true })).toBeVisible();
});

test("orb accepts reactive seed and debounced container resizing", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/?scenario=orb");
	const canvas = page.locator("canvas");
	await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(120);
	await page.getByRole("button", { name: "Resize orb" }).click();
	await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(180);
	expect(errors).toEqual([]);
});
