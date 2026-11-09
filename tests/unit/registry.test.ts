import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
	items: {
		name: string;
		registryDependencies?: string[];
		files?: { path: string; target?: string }[];
	}[];
};
const root = path.resolve("src/lib/registry/ui");
describe("registry dependency closure", () => {
	it("covers the pinned ElevenLabs UI component and block inventories", () => {
		const baseline = JSON.parse(readFileSync("tests/fixtures/upstream-parity.json", "utf8")) as {
			ui: string[];
			blocks: string[];
		};
		const names = new Set(registry.items.map((item) => item.name));
		for (const name of [...baseline.ui, ...baseline.blocks])
			expect(names.has(name), name).toBe(true);
	});
	for (const item of registry.items)
		it(`${item.name} ships its local imports or declares their registry dependencies`, () => {
			const shipped = new Set((item.files ?? []).map((f) => path.resolve(f.path)));
			const dependencies = new Set(
				(item.registryDependencies ?? []).map((d) =>
					d.startsWith("https://") ? path.basename(d, ".json") : d
				)
			);
			for (const file of item.files ?? []) {
				expect(existsSync(file.path), file.path).toBe(true);
				if (!/\.(ts|svelte)$/.test(file.path)) continue;
				const source = readFileSync(file.path, "utf8");
				const scripts = file.path.endsWith(".svelte")
					? [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n")
					: source;
				const ast = ts.createSourceFile(file.path + ".ts", scripts, ts.ScriptTarget.Latest, true);
				const imports: string[] = [];
				function visit(node: ts.Node) {
					if (
						(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
						node.moduleSpecifier &&
						ts.isStringLiteral(node.moduleSpecifier)
					)
						imports.push(node.moduleSpecifier.text);
					if (
						ts.isLiteralTypeNode(node) &&
						ts.isStringLiteral(node.literal) &&
						ts.isImportTypeNode(node.parent)
					)
						imports.push(node.literal.text);
					ts.forEachChild(node, visit);
				}
				visit(ast);
				for (const specifier of imports) {
					let target: string;
					if (specifier.startsWith("."))
						target = path.resolve(path.dirname(file.path), specifier.split("?")[0]);
					else if (specifier.startsWith("$lib/registry/"))
						target = path.resolve("src/lib", specifier.slice(5));
					else continue;
					const candidates = [
						target,
						target.replace(/\.js$/, ".ts"),
						path.join(target, "index.ts"),
					];
					if (candidates.some((candidate) => shipped.has(candidate))) continue;
					const relative = path.relative(root, target);
					expect(relative.startsWith(".."), `${file.path}: unshipped ${specifier}`).toBe(false);
					const component = relative.split(path.sep)[0];
					expect(
						dependencies.has(component),
						`${item.name} must declare ${component} (${specifier})`
					).toBe(true);
				}
			}
		});
	it("keeps optional SDK adapters out of the all-components install", () => {
		const all = registry.items.find((i) => i.name === "all")!;
		expect(all.registryDependencies?.some((d) => d.includes("adapter-"))).toBe(false);
	});
	it("uses targets relative to the consumer's components alias", () => {
		for (const item of registry.items)
			for (const file of item.files ?? [])
				expect(file.target?.startsWith("components/")).toBe(false);
	});
});
