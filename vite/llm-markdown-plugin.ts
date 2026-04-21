import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import { extractAllProps } from "../scripts/extract-props.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "content");
const OUTPUT_DIR = join(ROOT, "static", "docs");
const EXAMPLES_DIR = join(ROOT, "src", "lib", "registry", "examples");

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

function generateOne(sourcePath: string) {
	const source = readFileSync(sourcePath, "utf-8");
	const out = outputPathFor(sourcePath);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, transform(source));
}

function generateAll() {
	rmSync(OUTPUT_DIR, { recursive: true, force: true });
	rmSync(join(ROOT, "static", "docs.md"), { force: true });
	for (const file of walkMd(CONTENT_DIR)) {
		generateOne(file);
	}
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
