import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, normalizePath, type Plugin } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { spawn } from "node:child_process";
import { invalidatePropsCache } from "./scripts/extract-props.js";

function shadcnRegistry(): Plugin {
	// SvelteKit drives client + SSR builds in the same Vite run, so buildStart
	// fires twice per `pnpm build`. Share a single Promise so the second call
	// awaits the first spawn instead of returning early while the CLI is still
	// writing `static/r/*.json`.
	let pending: Promise<void> | null = null;
	const runCli = () =>
		new Promise<void>((resolve, reject) => {
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
	return {
		name: "shadcn-registry-build",
		// Force this plugin's buildStart to run before SvelteKit's so the
		// registry JSON exists in `static/r/` before adapter-static copies
		// `static/` into the build output.
		enforce: "pre",
		async buildStart() {
			pending ??= runCli();
			await pending;
		},
	};
}

function extractProps(): Plugin {
	// The props index is extracted lazily and memoized inside
	// scripts/extract-props.js (see `extractAllProps` / `invalidatePropsCache`).
	// This plugin only invalidates that cache when a source file that feeds
	// the extractor changes during dev, then triggers a full reload so the
	// docs preprocessor runs again with fresh data.
	return {
		name: "extract-component-props",
		apply: "serve",
		configureServer(server) {
			const shouldInvalidate = (path: string) => {
				const p = normalizePath(path);
				// Component sources feed the extractor; doc files enumerate which
				// components appear in the index (see listComponentNames).
				return (
					/\/src\/lib\/registry\/ui\/[^/]+\/[^/]+\.svelte$/.test(p) ||
					/\/content\/components\/[^/]+\.md$/.test(p)
				);
			};
			const handle = (path: string) => {
				if (!shouldInvalidate(path)) return;
				invalidatePropsCache();
				server.ws.send({ type: "full-reload" });
			};
			server.watcher.on("add", handle);
			server.watcher.on("change", handle);
			server.watcher.on("unlink", handle);
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
