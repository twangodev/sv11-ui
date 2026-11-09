// @ts-check
import { mdsx } from "mdsx";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import MagicString from "magic-string";
import { mdsxConfig } from "./mdsx.config.js";
import { parse, print } from "svelte/compiler";
import { expandDocTags } from "./scripts/docs-transform.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		docSugar(),
		mdsx(mdsxConfig),
		componentPreviews(),
		componentsList(),
		colorPalette(),
	],
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

/** Expand shared documentation tags before MDSX highlights the generated fences.
 * @returns {import("svelte/compiler").PreprocessorGroup}
 */
function docSugar() {
	return {
		name: "doc-sugar",
		markup: ({ content, filename }) => {
			if (!filename?.endsWith(".md")) return;
			return expandDocTags(content);
		},
	};
}

/**
 * Add imports to MDSX's instance script using Svelte's parser and printer.
 * Script attributes and module scripts are preserved by the parsed structure.
 *
 * @param {MagicString} ms
 * @param {string} content
 * @param {string[]} importLines
 */
function appendInstanceImports(ms, content, importLines) {
	const { instance } = parse(content, { modern: true });
	if (!instance) return;
	const imports = parse(`<script>${importLines.join("\n")}</script>`, { modern: true }).instance;
	if (!imports) return;
	const updated = {
		...instance,
		content: { ...instance.content, body: [...imports.content.body, ...instance.content.body] },
	};
	ms.overwrite(instance.start, instance.end, print(updated).code);
}

/**
 * Build a preprocessor that injects a single component import whenever `target`
 * appears in a .md doc, so docs can reference a shared display component by tag.
 * Used for `<ComponentsList />` and `<ColorPalette />`.
 *
 * @param {string} name
 * @param {string} target  e.g. "<ColorPalette"
 * @param {string} importLine
 * @returns {import("svelte/compiler").PreprocessorGroup}
 */
function injectComponentImport(name, target, importLine) {
	return {
		name,
		markup: ({ content, filename }) => {
			if (!filename?.endsWith(".md") || !content.includes(target)) return;
			if (!content.includes("<script>") && !content.includes("<script ")) return;

			const ms = new MagicString(content);
			appendInstanceImports(ms, content, [importLine]);
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

			appendInstanceImports(ms, content, imports);
			return { code: ms.toString(), map: ms.generateMap() };
		},
	};
}

/**
 * Injects a ComponentsList import whenever `<ComponentsList />` appears in a
 * .md doc. Runs after mdsx so the instance `<script>` tag exists.
 *
 * @returns {import("svelte/compiler").PreprocessorGroup}
 */
function componentsList() {
	return injectComponentImport(
		"inject-components-list",
		"<ComponentsList",
		`import ComponentsList from "$lib/components/components-list.svelte";`
	);
}

/**
 * Injects a ColorPalette import whenever `<ColorPalette />` appears in a .md doc.
 *
 * @returns {import("svelte/compiler").PreprocessorGroup}
 */
function colorPalette() {
	return injectComponentImport(
		"inject-color-palette",
		"<ColorPalette",
		`import ColorPalette from "$lib/components/color-palette.svelte";`
	);
}
