import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rename } from "node:fs/promises";
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
const dirty = execFileSync(
	"git",
	["status", "--porcelain", "--", "apps/www/registry/elevenlabs-ui"],
	{ cwd: source, encoding: "utf8" }
).trim();
if (dirty)
	throw new Error("Use an unmodified upstream checkout so the reference stays trustworthy.");
const destination = await mkdtemp(path.join(tmpdir(), "sv11-visual-reference-"));
await cp(path.join(directory, "reference"), destination, { recursive: true });
for (const file of await readdir(destination)) {
	if (file.endsWith(".template"))
		await rename(path.join(destination, file), path.join(destination, file.slice(0, -9)));
}
await cp(
	path.join(source, "apps/www/registry/elevenlabs-ui"),
	path.join(destination, "registry/elevenlabs-ui"),
	{ recursive: true }
);
await cp(path.join(source, "apps/www/lib"), path.join(destination, "lib"), { recursive: true });
await cp(path.join(source, "LICENSE.md"), path.join(destination, "UPSTREAM-LICENSE.md"));
console.log(destination);
