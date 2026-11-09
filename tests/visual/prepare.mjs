import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2];
if (!source) throw new Error("Usage: node tests/visual/prepare.mjs /path/to/elevenlabs-ui");
const inventory = JSON.parse(
	await readFile(path.join(directory, "../fixtures/upstream-parity.json"), "utf8")
);
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	cwd: source,
	encoding: "utf8",
}).trim();
if (revision !== inventory.revision)
	throw new Error(`Expected upstream ${inventory.revision}, found ${revision}.`);
const destination = await mkdtemp(path.join(tmpdir(), "sv11-visual-reference-"));
await cp(path.join(directory, "reference"), destination, { recursive: true });
for (const file of await readdir(destination)) {
	if (file.endsWith(".template"))
		await rename(path.join(destination, file), path.join(destination, file.slice(0, -9)));
}
await cp(
	path.join(directory, "../fixtures/upstream-parity.json"),
	path.join(destination, "upstream-parity.json")
);
const tree = await mkdtemp(path.join(tmpdir(), "sv11-visual-source-"));
try {
	// Read every reference source from the pinned commit, regardless of working-tree changes.
	const archive = execFileSync(
		"git",
		[
			"archive",
			"--format=tar",
			inventory.revision,
			"--",
			"apps/www/registry/elevenlabs-ui",
			"apps/www/lib",
			"LICENSE.md",
		],
		{ cwd: source, maxBuffer: 64 * 1024 * 1024 }
	);
	execFileSync("tar", ["-xf", "-", "-C", tree], { input: archive });
	await cp(
		path.join(tree, "apps/www/registry/elevenlabs-ui"),
		path.join(destination, "registry/elevenlabs-ui"),
		{ recursive: true }
	);
	await cp(path.join(tree, "apps/www/lib"), path.join(destination, "lib"), { recursive: true });
	await cp(path.join(tree, "LICENSE.md"), path.join(destination, "UPSTREAM-LICENSE.md"));
} finally {
	await rm(tree, { recursive: true, force: true });
}
console.log(destination);
