// @ts-check
/**
 * Extracts component prop metadata from Svelte registry sources.
 *
 * Pure function — no I/O. Consumers (svelte.config.js preprocessor, vite.config.ts
 * plugin) call `extractAllProps()` and use the returned index directly.
 *
 * For each component listed in `content/components/*.md` (excluding index.md),
 * reads `src/lib/registry/ui/<name>/<name>.svelte`, parses its TypeScript
 * blocks, and returns a structured record. The preprocessor consumes this
 * at doc-build time to render `<ComponentAPI component="<name>" />` tables.
 *
 * MODE: lenient. Missing JSDoc descriptions and missing defaults produce empty
 * cells — the extractor does not throw. Once every component has JSDoc on its
 * Props type, flip `STRICT_MODE` below to `true` to enforce documentation on
 * all new props going forward.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind } from "ts-morph";

const STRICT_MODE = false;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONTENT_DIR = join(ROOT, "content", "components");
const REGISTRY_DIR = join(ROOT, "src", "lib", "registry", "ui");

/**
 * @typedef {{ name: string; type: string; optional: boolean; description: string; default: string }} Prop
 * @typedef {{ props: Prop[] }} ExtractResult
 * @typedef {Record<string, ExtractResult>} PropsIndex
 */

/** @param {string} name */
function toPascalCase(name) {
	return name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function listComponentNames() {
	return readdirSync(CONTENT_DIR)
		.filter((f) => f.endsWith(".md") && f !== "index.md")
		.map((f) => f.replace(/\.md$/, ""))
		.sort();
}

/** @param {string} source */
function splitScripts(source) {
	const moduleMatch = source.match(/<script\b[^>]*\bmodule\b[^>]*>([\s\S]*?)<\/script>/);
	const instanceMatch = source.match(/<script(?![^>]*\bmodule\b)[^>]*>([\s\S]*?)<\/script>/);
	return {
		module: moduleMatch ? moduleMatch[1] : null,
		instance: instanceMatch ? instanceMatch[1] : null,
	};
}

/**
 * @param {import("ts-morph").TypeNode | undefined} typeNode
 * @returns {import("ts-morph").PropertySignature[]}
 */
function collectLiteralMembers(typeNode) {
	if (!typeNode) return [];
	if (typeNode.isKind(SyntaxKind.TypeLiteral)) {
		return typeNode.getMembers().filter((m) => m.isKind(SyntaxKind.PropertySignature));
	}
	if (typeNode.isKind(SyntaxKind.IntersectionType)) {
		return typeNode.getTypeNodes().flatMap(collectLiteralMembers);
	}
	return [];
}

/** @param {import("ts-morph").JSDoc[]} docs */
function extractDefaultFromJsDoc(docs) {
	for (const doc of docs) {
		for (const tag of doc.getTags()) {
			if (tag.getTagName() === "default") {
				return (tag.getCommentText() ?? "").trim();
			}
		}
	}
	return "";
}

/** @param {import("ts-morph").JSDoc[]} docs */
function extractDescriptionFromJsDoc(docs) {
	for (const doc of docs) {
		const desc = doc.getDescription().trim();
		if (desc) return desc;
	}
	return "";
}

/** @param {string} instanceSource */
function parseDestructuringDefaults(instanceSource) {
	const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: false } });
	const file = project.createSourceFile("__instance.ts", instanceSource, { overwrite: true });
	/** @type {Record<string, string>} */
	const defaults = {};

	file.forEachDescendant((node) => {
		if (!node.isKind(SyntaxKind.CallExpression)) return;
		const call = node.asKindOrThrow(SyntaxKind.CallExpression);
		if (call.getExpression().getText() !== "$props") return;

		let parent = call.getParent();
		while (parent && !parent.isKind(SyntaxKind.VariableDeclaration)) {
			parent = parent.getParent();
		}
		if (!parent) return;
		const varDecl = parent.asKindOrThrow(SyntaxKind.VariableDeclaration);
		const nameNode = varDecl.getNameNode();
		if (!nameNode.isKind(SyntaxKind.ObjectBindingPattern)) return;

		for (const element of nameNode.getElements()) {
			const binding = element.getNameNode();
			if (!binding.isKind(SyntaxKind.Identifier)) continue;
			const propName = element.getPropertyNameNode()?.getText() ?? binding.getText();
			const initializer = element.getInitializer();
			if (initializer) {
				defaults[propName] = initializer.getText();
			}
		}
	});

	return defaults;
}

/**
 * Look up a type alias by name across any of the provided source files.
 * @param {import("ts-morph").SourceFile[]} files
 * @param {string} name
 * @returns {import("ts-morph").TypeNode | undefined}
 */
function findTypeAlias(files, name) {
	for (const file of files) {
		for (const alias of file.getTypeAliases()) {
			if (alias.getName() === name) return alias.getTypeNode();
		}
	}
	return undefined;
}

/**
 * Resolves the Props TypeNode for a component. Handles three declaration
 * shapes seen in the registry:
 *
 *  1. `export type <Name>Props = ...` in the `<script module>` block.
 *  2. `export type <Name>Props = ...` in the instance `<script>` block.
 *  3. Inline annotation on `$props()` with no named alias.
 *
 * When the `$props()` annotation is itself a named reference (e.g.
 * `: LiveWaveformProps = $props()`), we resolve the reference back to its
 * alias declaration in either block.
 *
 * @param {string | null} moduleSource
 * @param {string | null} instanceSource
 * @param {string} componentName
 * @returns {import("ts-morph").TypeNode | undefined}
 */
function resolvePropsTypeNode(moduleSource, instanceSource, componentName) {
	const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: false } });
	/** @type {import("ts-morph").SourceFile[]} */
	const files = [];
	if (moduleSource) {
		files.push(project.createSourceFile("__module.ts", moduleSource, { overwrite: true }));
	}
	if (instanceSource) {
		files.push(project.createSourceFile("__instance.ts", instanceSource, { overwrite: true }));
	}

	// Strategy 1: look for `<PascalName>Props` in EITHER block.
	const expected = `${toPascalCase(componentName)}Props`;
	const byExactName = findTypeAlias(files, expected);
	if (byExactName) return byExactName;

	// Strategy 2: any `*Props` alias as a fallback.
	for (const file of files) {
		for (const alias of file.getTypeAliases()) {
			if (alias.getName().endsWith("Props")) return alias.getTypeNode();
		}
	}

	// Strategy 3: inline annotation on the instance block's $props() call.
	const instanceFile = instanceSource ? files[files.length - 1] : null;
	if (!instanceFile) return undefined;

	/** @type {import("ts-morph").TypeNode | undefined} */
	let found;
	instanceFile.forEachDescendant((node) => {
		if (found) return;
		if (!node.isKind(SyntaxKind.CallExpression)) return;
		const call = node.asKindOrThrow(SyntaxKind.CallExpression);
		if (call.getExpression().getText() !== "$props") return;
		let parent = call.getParent();
		while (parent && !parent.isKind(SyntaxKind.VariableDeclaration)) {
			parent = parent.getParent();
		}
		if (!parent) return;
		const varDecl = parent.asKindOrThrow(SyntaxKind.VariableDeclaration);
		found = varDecl.getTypeNode();
	});
	if (!found) return undefined;

	// If the annotation is itself a named reference, resolve to its alias.
	if (found.isKind(SyntaxKind.TypeReference)) {
		const refName = found.asKindOrThrow(SyntaxKind.TypeReference).getTypeName().getText();
		const resolved = findTypeAlias(files, refName);
		if (resolved) return resolved;
	}
	return found;
}

/**
 * @param {string} componentName
 * @returns {ExtractResult | null}
 */
function extractForComponent(componentName) {
	const svelteFile = join(REGISTRY_DIR, componentName, `${componentName}.svelte`);
	if (!existsSync(svelteFile)) {
		console.warn(`[extract-props] no svelte file for '${componentName}' at ${svelteFile}`);
		return null;
	}

	const source = readFileSync(svelteFile, "utf-8");
	const { module: moduleSource, instance: instanceSource } = splitScripts(source);

	const typeNode = resolvePropsTypeNode(moduleSource, instanceSource, componentName);
	if (!typeNode) {
		console.warn(`[extract-props] no props type resolved for '${componentName}'`);
		return { props: [] };
	}

	const members = collectLiteralMembers(typeNode);
	const destructuringDefaults = instanceSource ? parseDestructuringDefaults(instanceSource) : {};
	/** @type {Prop[]} */
	const props = [];
	/** @type {string[]} */
	const undocumented = [];

	for (const m of members) {
		const name = m.getName();
		const type = m.getTypeNode()?.getText() ?? "unknown";
		const optional = m.hasQuestionToken();
		const docs = m.getJsDocs();
		const description = extractDescriptionFromJsDoc(docs);
		const jsDocDefault = extractDefaultFromJsDoc(docs);
		const destructDefault = destructuringDefaults[name] ?? "";
		const def = jsDocDefault || destructDefault;

		if (!description) undocumented.push(name);
		props.push({ name, type, optional, description, default: def });
	}

	if (STRICT_MODE && undocumented.length > 0) {
		throw new Error(
			`[extract-props] ${componentName}: missing JSDoc on props: ${undocumented.join(", ")}`
		);
	}

	return { props };
}

/**
 * Process-local memoized cache of the extracted props index.
 *
 * Shared across all consumers in the same Node process. Set by the first call
 * to `extractAllProps()`, cleared by `invalidatePropsCache()` (called from the
 * Vite plugin in `vite.config.ts` when a registry component file changes).
 *
 * @type {PropsIndex | null}
 */
let cache = null;

/** @returns {void} */
export function invalidatePropsCache() {
	cache = null;
}

/** @returns {PropsIndex} */
export function extractAllProps() {
	if (cache) return cache;
	const names = listComponentNames();
	/** @type {PropsIndex} */
	const index = {};
	for (const name of names) {
		const result = extractForComponent(name);
		if (result) index[name] = result;
	}
	cache = index;
	return index;
}
