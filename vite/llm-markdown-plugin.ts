import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import { extractAllProps } from "../scripts/extract-props.js";
import { COLOR_GROUPS, tokenUtility } from "../src/lib/components/color-tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "content");
const STATIC_DIR = join(ROOT, "static");
const OUTPUT_DIR = join(STATIC_DIR, "docs");
const EXAMPLES_DIR = join(ROOT, "src", "lib", "registry", "examples");

// Section grouping for llms.txt. Root-level docs are "Get Started"; nested
// dirs become their own title-cased section. SECTION_ORDER pins the lead
// sections; GET_STARTED_ORDER mirrors the sidebar order in navigation.ts.
const SECTION_ORDER = ["Get Started", "Adapters", "Components"];
const GET_STARTED_ORDER = [
	"index",
	"setup",
	"usage",
	"providers",
	"theming",
	"colors",
	"dark-mode",
	"troubleshooting",
];

const DEFAULT_ORIGIN = "https://sv11.ui.twango.dev";

// Single source of truth for the public origin: registry.json's homepage, the
// same value the shadcn registry build stamps into r/*.json.
function siteOrigin(): string {
	try {
		const reg = JSON.parse(readFileSync(join(ROOT, "registry.json"), "utf-8")) as {
			homepage?: unknown;
		};
		if (typeof reg.homepage === "string" && reg.homepage) return reg.homepage.replace(/\/+$/, "");
	} catch {
		/* fall through to default */
	}
	return DEFAULT_ORIGIN;
}

type Prop = {
	name: string;
	type: string;
	optional: boolean;
	description: string;
	default: string;
};

const INSTALL_RE = /<Install\s+component=["']([^"']+)["']\s*\/>/g;
const USAGE_RE = /<Usage\s+component=["']([^"']+)["']\s*\/>/g;
const API_RE = /<ComponentAPI\s+component=["']([^"']+)["']\s*\/>/g;
const PREVIEW_RE = /<ComponentPreview\s+name=["']([^"']+)["'][^/]*\/>/g;
const SOURCE_RE = /<ComponentSource\s+name=["']([^"']+)["'][^/]*\/>/g;
const COLOR_PALETTE_RE = /<ColorPalette\s*\/>/g;

const toPascal = (name: string) => name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
const flatten = (s: string) => s.replace(/\s+/g, " ").trim();
const escapeCell = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

function expandInstall(name: string) {
	return [
		"```bash",
		`npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/${name}.json`,
		"```",
	].join("\n");
}

function expandUsage(name: string) {
	const exportName = toPascal(name);
	return [
		"```svelte",
		`<script lang="ts">`,
		`\timport { ${exportName} } from "$lib/registry/ui/${name}";`,
		`</script>`,
		``,
		`<${exportName} />`,
		"```",
	].join("\n");
}

function expandComponentAPI(name: string) {
	const index = extractAllProps() as Record<string, { props: Prop[] }>;
	const entry = index[name];
	if (!entry) return `_Component \`${name}\` has no registered API._`;
	if (entry.props.length === 0) return `_This component takes no props._`;
	const rows = entry.props.map((p) => {
		const propName = `\`${flatten(p.name)}${p.optional ? "?" : ""}\``;
		const type = `\`${escapeCell(flatten(p.type))}\``;
		const def = p.default ? `\`${escapeCell(flatten(p.default))}\`` : "—";
		const desc = p.description ? escapeCell(flatten(p.description)) : "—";
		return `| ${propName} | ${type} | ${def} | ${desc} |`;
	});
	return [
		"| Prop | Type | Default | Description |",
		"| ---- | ---- | ------- | ----------- |",
		...rows,
	].join("\n");
}

function expandComponentPreview(name: string) {
	// The preview is an interactive Svelte component — can't serialize. Inline
	// the example source as a svelte fence so LLMs still see real usage.
	const path = join(EXAMPLES_DIR, `${name}.svelte`);
	try {
		const src = readFileSync(path, "utf-8").trim();
		return ["```svelte", src, "```"].join("\n");
	} catch {
		return `_Example \`${name}\` not found._`;
	}
}

function expandColorPalette(): string {
	// The palette is an interactive Svelte component; serialize the token list to
	// static markdown so the twin / llms-full.txt show real tokens, not raw Svelte.
	return COLOR_GROUPS.map((group) => {
		const rows = group.tokens.map((t) => `- \`--${t.name}\` → \`${tokenUtility(t)}\``);
		return [`### ${group.title}`, "", ...rows].join("\n");
	}).join("\n\n");
}

function parseFrontmatter(src: string) {
	const match = src.match(/^---\n([\s\S]*?)\n---\n?/);
	if (!match) return { body: src, title: undefined, description: undefined };
	const body = src.slice(match[0].length);
	const strip = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, "");
	const title = strip(match[1].match(/^title:\s*(.+)$/m)?.[1]);
	const description = strip(match[1].match(/^description:\s*(.+)$/m)?.[1]);
	return { body, title, description };
}

function transform(source: string): string {
	const { body, title, description } = parseFrontmatter(source);
	let out = body;
	// Drop a leading body H1 that duplicates the frontmatter title.
	if (title) {
		const leadingH1 = new RegExp(
			`^\\s*#\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+`
		);
		out = out.replace(leadingH1, "");
	}
	out = out.replace(INSTALL_RE, (_, n) => expandInstall(n));
	out = out.replace(USAGE_RE, (_, n) => expandUsage(n));
	out = out.replace(API_RE, (_, n) => expandComponentAPI(n));
	out = out.replace(PREVIEW_RE, (_, n) => expandComponentPreview(n));
	out = out.replace(SOURCE_RE, (_, n) => expandComponentPreview(n));
	out = out.replace(COLOR_PALETTE_RE, () => expandColorPalette());
	const header = [title && `# ${title}`, description && `> ${description}`]
		.filter(Boolean)
		.join("\n\n");
	return (header ? header + "\n\n" : "") + out.trim() + "\n";
}

function walkMd(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walkMd(full));
		else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
	}
	return out;
}

/**
 * Maps a content source path to its output location under static/docs/.
 *
 * content/index.md              → static/docs.md             (served at /docs.md)
 * content/foo.md                → static/docs/foo.md         (served at /docs/foo.md)
 * content/foo/index.md          → static/docs/foo.md         (collapse /index)
 * content/foo/bar.md            → static/docs/foo/bar.md
 *
 * Matches the slug resolution in src/lib/docs.ts so fetch(`${pageUrl}.md`)
 * hits the right file.
 */
function outputPathFor(sourcePath: string): string {
	const rel = relative(CONTENT_DIR, sourcePath);
	const INDEX_SUFFIX = `${sep}index.md`;
	if (rel === "index.md") return join(ROOT, "static", "docs.md");
	if (rel.endsWith(INDEX_SUFFIX)) {
		return join(OUTPUT_DIR, rel.slice(0, -INDEX_SUFFIX.length) + ".md");
	}
	return join(OUTPUT_DIR, rel);
}

/** Public URL path of a source file's `.md` twin (mirrors outputPathFor). */
function twinUrlPath(sourcePath: string): string {
	const out = outputPathFor(sourcePath);
	return "/" + relative(STATIC_DIR, out).split(sep).join("/");
}

/** "components/audio-player.md" → "Audio Player" (frontmatter title fallback). */
function deriveTitle(relPosix: string): string {
	const base = relPosix.replace(/\/index\.md$/, "").replace(/\.md$/, "");
	const last = base.split("/").pop() || "index";
	return last
		.split("-")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join(" ");
}

function sectionFor(relPosix: string): string {
	const parts = relPosix.split("/");
	if (parts.length === 1) return "Get Started";
	return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

type DocEntry = {
	rel: string; // posix path relative to CONTENT_DIR, e.g. "components/orb.md"
	url: string; // absolute URL of the .md twin
	title: string;
	description?: string;
	section: string;
	content: string; // transformed markdown twin
};

/** Slug used to match against GET_STARTED_ORDER: "setup.md" → "setup". */
function slugOf(rel: string): string {
	return rel.replace(/\/index\.md$/, "").replace(/\.md$/, "");
}

/** Order docs within a section: canonical Get Started order, else index-first + alpha. */
function entrySort(a: DocEntry, b: DocEntry): number {
	const ga = GET_STARTED_ORDER.indexOf(slugOf(a.rel));
	const gb = GET_STARTED_ORDER.indexOf(slugOf(b.rel));
	if (ga !== -1 || gb !== -1) return (ga === -1 ? 999 : ga) - (gb === -1 ? 999 : gb);
	const ia = a.rel === "index.md" || a.rel.endsWith("/index.md");
	const ib = b.rel === "index.md" || b.rel.endsWith("/index.md");
	if (ia !== ib) return ia ? -1 : 1;
	return a.title.localeCompare(b.title);
}

function sectionRank(name: string): number {
	const i = SECTION_ORDER.indexOf(name);
	return i === -1 ? 999 : i;
}

function buildLlmsTxt(origin: string, entries: DocEntry[]): string {
	const intro = entries.find((e) => e.rel === "index.md");
	const lines = [
		"# sv11-ui",
		"",
		`> ${intro?.description ?? "A component registry for building AI agent interfaces with Svelte 5."}`,
		"",
		`This is an index for LLMs. Every linked page has a clean Markdown version (append \`.md\` to any docs URL). For the entire documentation in a single file, see ${origin}/llms-full.txt.`,
	];

	const sections = new Map<string, DocEntry[]>();
	for (const e of entries) {
		const list = sections.get(e.section);
		if (list) list.push(e);
		else sections.set(e.section, [e]);
	}

	const names = [...sections.keys()].sort(
		(a, b) => sectionRank(a) - sectionRank(b) || a.localeCompare(b)
	);
	for (const name of names) {
		lines.push("", `## ${name}`, "");
		for (const e of sections.get(name)!.sort(entrySort)) {
			lines.push(`- [${e.title}](${e.url})${e.description ? `: ${e.description}` : ""}`);
		}
	}
	return lines.join("\n") + "\n";
}

function buildLlmsFull(origin: string, entries: DocEntry[]): string {
	const ordered = [...entries].sort((a, b) => {
		if (a.section !== b.section)
			return sectionRank(a.section) - sectionRank(b.section) || a.section.localeCompare(b.section);
		return entrySort(a, b);
	});
	const header = `# sv11-ui\n\n> Full documentation corpus. Generated from ${origin}/docs.\n`;
	return header + "\n" + ordered.map((e) => e.content.trim()).join("\n\n---\n\n") + "\n";
}

function generateAll() {
	rmSync(OUTPUT_DIR, { recursive: true, force: true });
	rmSync(join(STATIC_DIR, "docs.md"), { force: true });
	rmSync(join(STATIC_DIR, "llms.txt"), { force: true });
	rmSync(join(STATIC_DIR, "llms-full.txt"), { force: true });

	const origin = siteOrigin();
	const entries: DocEntry[] = [];

	for (const file of walkMd(CONTENT_DIR)) {
		const source = readFileSync(file, "utf-8");
		const { title, description } = parseFrontmatter(source);
		const content = transform(source);
		const out = outputPathFor(file);
		mkdirSync(dirname(out), { recursive: true });
		writeFileSync(out, content);

		const rel = relative(CONTENT_DIR, file).split(sep).join("/");
		entries.push({
			rel,
			url: origin + twinUrlPath(file),
			title: title ?? deriveTitle(rel),
			description,
			section: sectionFor(rel),
			content,
		});
	}

	writeFileSync(join(STATIC_DIR, "llms.txt"), buildLlmsTxt(origin, entries));
	writeFileSync(join(STATIC_DIR, "llms-full.txt"), buildLlmsFull(origin, entries));
}

export function llmMarkdownPlugin(): Plugin {
	let pending: Promise<void> | null = null;
	return {
		name: "llm-markdown",
		enforce: "pre",
		async buildStart() {
			// SvelteKit fires buildStart twice (client + SSR). Share one run.
			pending ??= (async () => generateAll())().catch((err) => {
				pending = null;
				throw err;
			});
			await pending;
		},
		configureServer(server) {
			const CONTENT_NORM = normalizePath(CONTENT_DIR);
			const EXAMPLES_NORM = normalizePath(EXAMPLES_DIR);
			const regen = (p: string) => {
				const n = normalizePath(p);
				const inContent = n === CONTENT_NORM || n.startsWith(CONTENT_NORM + "/");
				const inExamples = n === EXAMPLES_NORM || n.startsWith(EXAMPLES_NORM + "/");
				if (!inContent && !inExamples) return;
				if (!n.endsWith(".md") && !n.endsWith(".svelte")) return;
				try {
					generateAll();
				} catch (err) {
					server.config.logger.error(
						`[llm-markdown] ${err instanceof Error ? err.message : String(err)}`
					);
				}
			};
			server.watcher.on("add", regen);
			server.watcher.on("change", regen);
			server.watcher.on("unlink", regen);
		},
	};
}
