// @ts-check
import { mdsx } from "mdsx";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import MagicString from "magic-string";
import { mdsxConfig } from "./mdsx.config.js";
import { extractAllProps } from "./scripts/extract-props.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess(), docSugar(), mdsx(mdsxConfig), componentPreviews()],
	extensions: [".svelte", ".md"],

	kit: {
		adapter: adapter({
			fallback: "404.html",
		}),
		prerender: {
			handleMissingId: (details) => {
				if (details.id === "#") return;
				console.warn(details.message);
			},
			handleHttpError: (details) => {
				console.warn(details.message);
			},
		},
		alias: {
			"$content/*": ".velite/*",
		},
	},
};

export default config;

/**
 * Rewrites authoring sugar in .md docs into plain markdown BEFORE mdsx runs.
 *
 * Supported tags (must be self-closing with a `component="<name>"` attribute):
 *   <Install component="orb" />       → ```bash fence with the shadcn-svelte CLI command
 *   <Usage component="orb" />         → ```svelte fence with a minimal import + bare usage
 *   <ComponentAPI component="orb" />  → markdown props table from extracted TS types
 *
 * Expansion happens pre-mdsx so shiki highlights the resulting code fences
 * naturally and mdsx's normal markdown pipeline handles everything downstream.
 *
 * The Usage expansion uses a PascalCase-of-kebab-name convention for the
 * exported component (e.g. `audio-player` → `AudioPlayer`). Authors whose
 * barrel exports an unusual name should write the fence manually instead.
 *
 * The ComponentAPI expansion calls `extractAllProps()` from extract-props.js,
 * which memoizes across the process. No pre-build step is required. Cache
 * invalidation on file changes is driven by the `extract-component-props`
 * Vite plugin (see vite.config.ts).
 *
 * @returns {import("svelte/compiler").PreprocessorGroup}
 */
function docSugar() {
	const INSTALL_REGEX = /<Install\s+component=["']([^"']+)["']\s*\/>/g;
	const USAGE_REGEX = /<Usage\s+component=["']([^"']+)["']\s*\/>/g;
	const API_REGEX = /<ComponentAPI\s+component=["']([^"']+)["']\s*\/>/g;

	const toPascalCase = (/** @type {string} */ name) =>
		name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

	// Markdown-table cell escaping. Backslashes must be escaped first — otherwise
	// a literal `\` before `|` in a prop type or JSDoc description would render
	// as `\` + an escaped pipe instead of being a single escaped pipe.
	const escapeCell = (/** @type {string} */ s) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

	// Markdown tables require one row per line — any literal newline in a cell
	// value (most commonly in multi-line JSDoc descriptions) would fragment
	// the row. Collapse all whitespace runs to a single space.
	const flatten = (/** @type {string} */ s) => s.replace(/\s+/g, " ").trim();

	// JSDoc description cells are NOT wrapped in backticks — they render as
	// prose. If the prose contains `<`, `>`, `{`, or `}`, mdsx will parse them
	// as component tags or Svelte expressions and either crash the build or
	// mount live elements in the API table. Escape to HTML entities before
	// emitting.
	const escapeMdx = (/** @type {string} */ s) =>
		s.replace(
			/[<>{}]/g,
			(c) =>
				/** @type {Record<string, string>} */ ({
					"<": "&lt;",
					">": "&gt;",
					"{": "&#123;",
					"}": "&#125;",
				})[c]
		);

	const expandInstall = (/** @type {string} */ name) =>
		[
			"```bash",
			`npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/${name}.json`,
			"```",
		].join("\n");

	const expandUsage = (/** @type {string} */ name) => {
		const exportName = toPascalCase(name);
		return [
			"```svelte",
			`<script lang="ts">`,
			`\timport { ${exportName} } from "$lib/registry/ui/${name}";`,
			`</script>`,
			``,
			`<${exportName} />`,
			"```",
		].join("\n");
	};

	const expandComponentAPI = (/** @type {string} */ name) => {
		const index = extractAllProps();
		const entry = index[name];
		if (!entry) {
			throw new Error(
				`<ComponentAPI component="${name}" /> but '${name}' not registered. ` +
					`Ensure 'content/components/${name}.md' exists and 'src/lib/registry/ui/${name}/${name}.svelte' is present.`
			);
		}
		if (entry.props.length === 0) {
			return `_This component takes no props._`;
		}
		const rows = entry.props.map((p) => {
			const propName = `\`${flatten(p.name)}${p.optional ? "?" : ""}\``;
			const type = `\`${escapeCell(flatten(p.type))}\``;
			const def = p.default ? `\`${escapeCell(flatten(p.default))}\`` : "—";
			const desc = p.description ? escapeMdx(escapeCell(flatten(p.description))) : "—";
			return `| ${propName} | ${type} | ${def} | ${desc} |`;
		});
		return [
			"| Prop | Type | Default | Description |",
			"| ---- | ---- | ------- | ----------- |",
			...rows,
		].join("\n");
	};

	// Precompute [start, end) ranges for fenced code blocks and inline code
	// spans so we can skip sugar tags that appear inside them. Without this,
	// a doc page demonstrating the sugar itself (e.g. showing a literal
	// `<Install component="x" />` inside a ```md fence) would have its example
	// corrupted by expansion.
	const FENCE_REGEX = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm;
	const INLINE_REGEX = /`+[^`\n]+`+/g;
	/**
	 * @param {string} source
	 * @returns {Array<[number, number]>}
	 */
	const codeRanges = (source) => {
		/** @type {Array<[number, number]>} */
		const ranges = [];
		for (const m of source.matchAll(FENCE_REGEX)) {
			if (m.index === undefined) continue;
			ranges.push([m.index, m.index + m[0].length]);
		}
		for (const m of source.matchAll(INLINE_REGEX)) {
			if (m.index === undefined) continue;
			ranges.push([m.index, m.index + m[0].length]);
		}
		return ranges;
	};
	/**
	 * @param {Array<[number, number]>} ranges
	 * @param {number} index
	 */
	const inCode = (ranges, index) => ranges.some(([s, e]) => index >= s && index < e);

	return {
		name: "doc-sugar",
		markup: ({ content, filename }) => {
			if (!filename?.endsWith(".md")) return;
			const hasInstall = content.includes("<Install");
			const hasUsage = content.includes("<Usage");
			const hasApi = content.includes("<ComponentAPI");
			if (!hasInstall && !hasUsage && !hasApi) return;

			const ms = new MagicString(content);
			const ranges = codeRanges(content);

			for (const match of content.matchAll(INSTALL_REGEX)) {
				if (match.index === undefined || inCode(ranges, match.index)) continue;
				ms.overwrite(match.index, match.index + match[0].length, expandInstall(match[1]));
			}

			for (const match of content.matchAll(USAGE_REGEX)) {
				if (match.index === undefined || inCode(ranges, match.index)) continue;
				ms.overwrite(match.index, match.index + match[0].length, expandUsage(match[1]));
			}

			for (const match of content.matchAll(API_REGEX)) {
				if (match.index === undefined || inCode(ranges, match.index)) continue;
				ms.overwrite(match.index, match.index + match[0].length, expandComponentAPI(match[1]));
			}

			return { code: ms.toString(), map: ms.generateMap() };
		},
	};
}

/**
 * @returns {import("svelte/compiler").PreprocessorGroup}
 */
function componentPreviews() {
	const TARGET = "<ComponentPreview";
	const camelize = (/** @type {string} */ s) => s.replace(/-./g, (w) => w[1].toUpperCase());

	return {
		name: "inject-component-preview",
		markup: ({ content, filename }) => {
			if (!filename?.endsWith(".md") || !content.includes(TARGET)) return;

			// Skip if called inside mdsx's internal preprocessing (no script tags yet)
			// We need the instance <script> tag to exist so we can inject imports
			if (!content.includes("<script>") && !content.includes("<script ")) return;

			const ms = new MagicString(content);
			const results = content.matchAll(/<ComponentPreview name=["|']([^\s]*)["|']/g);
			const components = new Set();
			for (const exec of results) {
				const [, name] = exec;
				const insertIndex = exec.index + TARGET.length;
				const identifier = camelize(name);
				const prop = ` component={${identifier}}`;
				ms.appendRight(insertIndex, prop);

				components.add(name);
			}

			// Build all import statements we need to inject
			const imports = [`import ComponentPreview from "$lib/components/component-preview.svelte";`];
			for (const name of components) {
				const identifier = camelize(name);
				imports.push(`import ${identifier} from "$lib/registry/examples/${name}.svelte";`);
			}

			// Find the instance <script> tag (not <script module>) to insert imports after it
			// After mdsx processing, we have <script module>...</script> then <script>...</script>
			const scriptRegex = /<script(?:\s[^>]*)?>|<script>/g;
			let scriptMatch;
			while ((scriptMatch = scriptRegex.exec(content)) !== null) {
				// Skip <script module> or <script context="module"> tags
				if (scriptMatch[0].includes("module")) continue;
				// Found instance script - inject imports right after the opening tag
				const insertPos = scriptMatch.index + scriptMatch[0].length;
				ms.appendRight(insertPos, "\n" + imports.join("\n"));
				break;
			}

			return { code: ms.toString(), map: ms.generateMap() };
		},
	};
}
