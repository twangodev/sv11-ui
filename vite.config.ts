import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { spawn } from "node:child_process";
import { normalizePath } from "vite";
import { invalidatePropsCache } from "./scripts/extract-props.js";

function shadcnRegistry(): Plugin {
	// SvelteKit drives client + SSR builds in the same Vite run, so buildStart
	// fires twice per `pnpm build`. Guard so the registry CLI runs only once.
	let ran = false;
	return {
		name: "shadcn-registry-build",
		async buildStart() {
			if (ran) return;
			ran = true;
			await new Promise<void>((resolve, reject) => {
				const child = spawn("pnpm", ["shadcn-svelte", "registry", "build"], {
					stdio: "inherit",
					shell: true,
				});
				child.on("error", (err) => {
					reject(new Error(`failed to spawn shadcn-svelte: ${err.message}`));
				});
				child.on("exit", (code, signal) => {
					if (code === 0) resolve();
					else if (signal) reject(new Error(`shadcn-svelte registry build killed by ${signal}`));
					else reject(new Error(`shadcn-svelte registry build exited with code ${code}`));
				});
			});
		},
	};
}

function extractProps(): Plugin {
	// The props index is extracted lazily and memoized inside
	// scripts/extract-props.js (see `extractAllProps` / `invalidatePropsCache`).
	// This plugin only invalidates that cache when a registry component file
	// changes during dev, then triggers a full reload so the docs preprocessor
	// runs again with fresh data.
	return {
		name: "extract-component-props",
		configureServer(server) {
			server.watcher.on("change", (path) => {
				// Chokidar reports backslash-separated paths on Windows; normalize
				// before matching so the regex works cross-platform.
				if (!/src\/lib\/registry\/ui\/.*\.svelte$/.test(normalizePath(path))) return;
				invalidatePropsCache();
				server.ws.send({ type: "full-reload" });
			});
		},
	};
}

export default defineConfig({
	plugins: [shadcnRegistry(), extractProps(), tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		fs: {
			allow: ["content", ".velite"],
		},
	},
});
