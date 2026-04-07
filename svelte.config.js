// @ts-check
import { mdsx } from "mdsx";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import MagicString from "magic-string";
import { mdsxConfig } from "./mdsx.config.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess(), mdsx(mdsxConfig), componentPreviews()],
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
