// @ts-check
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import MagicString from "magic-string";
import { parse } from "svelte/compiler";
import { extractAllProps } from "./extract-props.js";

const registryFile = fileURLToPath(new URL("../registry.json", import.meta.url));

/** The public registry origin used in generated links and install commands. */
export function registryOrigin() {
	const registry = JSON.parse(readFileSync(registryFile, "utf8"));
	if (typeof registry.homepage !== "string" || !registry.homepage)
		throw new Error("registry.json must declare a homepage for generated documentation.");
	let origin = registry.homepage;
	while (origin.endsWith("/")) origin = origin.slice(0, -1);
	return origin;
}

/** @param {string} value */
const flatten = (value) => value.replace(/\s+/g, " ").trim();
/** @param {string} value */
const escapeCell = (value) => value.replaceAll("\\", "\\\\").replaceAll("|", "\\|");
/** Escape prose that both Markdown and MDSX will consume. @param {string} value */
const escapeProse = (value) =>
	escapeCell(flatten(value))
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("{", "&#123;")
		.replaceAll("}", "&#125;");

/** @param {string} name */
function installExample(name) {
	return ["```bash", `npx shadcn-svelte@latest add ${registryOrigin()}/r/${name}.json`, "```"].join(
		"\n"
	);
}

/** @param {string} name */
function usageExample(name) {
	const exportedName = name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
	return [
		"```svelte",
		'<script lang="ts">',
		`\timport { ${exportedName} } from "$lib/components/ui/${name}";`,
		"</script>",
		"",
		`<${exportedName} />`,
		"```",
	].join("\n");
}

/** @param {string} name */
function componentApi(name) {
	const entry = extractAllProps()[name];
	if (!entry) throw new Error(`ComponentAPI references unregistered component '${name}'.`);
	const inherited = entry.inheritedProps ?? [];
	const note = inherited.length
		? `Also accepts inherited props from ${inherited.map((type) => `\`${escapeCell(flatten(type))}\``).join(", ")}. The table lists this component's own props; inherited props are not expanded.`
		: "";
	if (entry.props.length === 0)
		return note || "_This component declares no component-specific props._";
	const rows = entry.props.map((prop) => {
		const name = `\`${flatten(prop.name)}${prop.optional ? "?" : ""}\``;
		const type = `\`${escapeCell(flatten(prop.type))}\``;
		const value = prop.default ? `\`${escapeCell(flatten(prop.default))}\`` : "—";
		const description = prop.description ? escapeProse(prop.description) : "—";
		return `| ${name} | ${type} | ${value} | ${description} |`;
	});
	return [
		"| Prop | Type | Default | Description |",
		"| ---- | ---- | ------- | ----------- |",
		...rows,
		...(note ? ["", note] : []),
	].join("\n");
}

/** @typedef {Record<string, (attributes: Record<string, string>) => string>} TagRenderers */

/** @param {Record<string, string>} attributes @param {string} key @param {string} tag */
function requiredAttribute(attributes, key, tag) {
	const value = attributes[key];
	if (!value) throw new Error(`${tag} requires a static '${key}' attribute.`);
	return value;
}

/**
 * Expand documentation tags only in Markdown HTML nodes. Fences, indented
 * code, and inline code stay opaque. Svelte parses tag names and attributes;
 * MagicString preserves all surrounding authored Markdown and source offsets.
 *
 * @param {string} source
 * @param {TagRenderers} [additionalTags] LLM-only renderers for examples/palettes.
 */
export function expandDocTags(source, additionalTags = {}) {
	/** @type {TagRenderers} */
	const renderers = {
		Install: (attrs) => installExample(requiredAttribute(attrs, "component", "Install")),
		Usage: (attrs) => usageExample(requiredAttribute(attrs, "component", "Usage")),
		ComponentAPI: (attrs) => componentApi(requiredAttribute(attrs, "component", "ComponentAPI")),
		...additionalTags,
	};
	const names = Object.keys(renderers);
	const output = new MagicString(source);
	visit(fromMarkdown(source), "html", (markdownNode) => {
		if (!names.some((name) => markdownNode.value.includes(`<${name}`))) return;
		const offset = markdownNode.position?.start.offset;
		if (offset === undefined) return;
		const parsed = parse(markdownNode.value, { modern: true });
		for (const node of parsed.fragment.nodes) {
			if (node.type !== "Component" || !renderers[node.name]) continue;
			/** @type {Record<string, string>} */
			const attributes = {};
			for (const attribute of node.attributes) {
				if (attribute.type !== "Attribute" || !Array.isArray(attribute.value)) continue;
				if (attribute.value.every((part) => part.type === "Text"))
					attributes[attribute.name] = attribute.value.map((part) => part.data).join("");
			}
			output.overwrite(offset + node.start, offset + node.end, renderers[node.name](attributes));
		}
	});
	return { code: output.toString(), map: output.generateMap() };
}
