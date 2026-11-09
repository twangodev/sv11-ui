import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
	root: path.resolve("tests/browser/app"),
	publicDir: path.resolve("static"),
	plugins: [svelte({ configFile: false }), tailwindcss()],
	resolve: { alias: { $lib: path.resolve("src/lib") } },
	server: { host: "127.0.0.1", port: 4174, strictPort: true, fs: { allow: [path.resolve(".")] } },
});
