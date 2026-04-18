import { spawn } from "node:child_process";
import { type Plugin } from "vite";

const run = () =>
	new Promise<void>((resolve, reject) => {
		// shell: true so Windows resolves pnpm.cmd (execFile cannot launch .cmd shims).
		const child = spawn(
			"pnpm",
			["exec", "git-cliff", "--config", "cliff.toml", "--output", "content/changelog.md"],
			{ stdio: "inherit", shell: true }
		);
		child.on("error", (err) => reject(new Error(`git-cliff: ${err.message}`)));
		child.on("exit", (code, signal) => {
			if (code === 0) resolve();
			else if (signal) reject(new Error(`git-cliff killed by ${signal}`));
			else reject(new Error(`git-cliff exited with code ${code}`));
		});
	});

export function changelogPlugin(): Plugin {
	// configResolved (not buildStart): buildStart runs concurrently across
	// plugins, so can't serialize ahead of velitePlugin's scan.
	let pending: Promise<void> | null = null;
	return {
		name: "changelog",
		enforce: "pre",
		async configResolved() {
			pending ??= run().catch((err) => {
				pending = null;
				throw err;
			});
			await pending;
		},
	};
}
