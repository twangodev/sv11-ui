import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { changelogPlugin } from "./vite/changelog-plugin.js";
import { extractPropsPlugin } from "./vite/extract-props-plugin.js";
import { llmMarkdownPlugin } from "./vite/llm-markdown-plugin.js";
import { shadcnRegistryPlugin } from "./vite/shadcn-registry-plugin.js";
import { velitePlugin } from "./vite/velite-plugin.js";
import { waveformsPlugin } from "./vite/waveforms-plugin.js";

export default defineConfig({
	plugins: [
		changelogPlugin(),
		velitePlugin(),
		shadcnRegistryPlugin(),
		waveformsPlugin(),
		extractPropsPlugin(),
		llmMarkdownPlugin(),
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
	],
	server: {
		fs: {
			allow: ["content", ".velite"],
		},
	},
});
