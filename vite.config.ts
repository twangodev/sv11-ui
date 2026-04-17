import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, type Plugin } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { spawn } from "node:child_process";
import { invalidatePropsCache } from "./scripts/extract-props.js";

function shadcnRegistry(): Plugin {
	return {
		name: "shadcn-registry-build",
		async buildStart() {
			await new Promise<void>((resolve, reject) => {
				const child = spawn("pnpm", ["shadcn-svelte", "registry", "build"], {
					stdio: "inherit",
					shell: true,
				});
				child.on("exit", (code) => {
					if (code === 0) resolve();
					else reject(new Error(`shadcn-svelte registry build exited with code ${code}`));
				});
			});
		},
	};
}

function extractProps(): Plugin {
	// The props index is extracted lazily and memoized inside svelte.config.js
	// (see `getPropsIndex` there). This plugin only invalidates that cache
	// when a registry component file changes during dev, then triggers a
	// full reload so the docs preprocessor runs again with fresh data.
	return {
		name: "extract-component-props",
		configureServer(server) {
			server.watcher.on("change", (path) => {
				if (!/src\/lib\/registry\/ui\/.*\.svelte$/.test(path)) return;
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
