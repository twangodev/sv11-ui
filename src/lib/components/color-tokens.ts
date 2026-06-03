// Single source of truth for the semantic color tokens shown on the Colors docs
// page. Shared between the interactive <ColorPalette /> component and the LLM
// markdown plugin (which serializes the palette into the docs twins).

export type ColorToken = { name: string; fg?: boolean };
export type ColorGroup = { title: string; tokens: ColorToken[] };

export const COLOR_GROUPS: ColorGroup[] = [
	{
		title: "Base",
		tokens: [
			{ name: "background" },
			{ name: "foreground", fg: true },
			{ name: "card" },
			{ name: "card-foreground", fg: true },
			{ name: "popover" },
			{ name: "popover-foreground", fg: true },
			{ name: "border" },
			{ name: "input" },
			{ name: "ring" },
		],
	},
	{
		title: "Semantic",
		tokens: [
			{ name: "primary" },
			{ name: "primary-foreground", fg: true },
			{ name: "secondary" },
			{ name: "secondary-foreground", fg: true },
			{ name: "muted" },
			{ name: "muted-foreground", fg: true },
			{ name: "accent" },
			{ name: "accent-foreground", fg: true },
			{ name: "destructive" },
		],
	},
	{
		title: "Charts",
		tokens: [
			{ name: "chart-1" },
			{ name: "chart-2" },
			{ name: "chart-3" },
			{ name: "chart-4" },
			{ name: "chart-5" },
		],
	},
	{
		title: "Sidebar",
		tokens: [
			{ name: "sidebar" },
			{ name: "sidebar-foreground", fg: true },
			{ name: "sidebar-primary" },
			{ name: "sidebar-primary-foreground", fg: true },
			{ name: "sidebar-accent" },
			{ name: "sidebar-accent-foreground", fg: true },
			{ name: "sidebar-border" },
			{ name: "sidebar-ring" },
		],
	},
];

/** The Tailwind utility you'd actually type for a token (`text-*` for foreground tokens, else `bg-*`). */
export function tokenUtility(token: ColorToken): string {
	return `${token.fg ? "text" : "bg"}-${token.name}`;
}

/**
 * The paired surface token to render *behind* a foreground token so its color is
 * visible (e.g. `card` for `card-foreground`, `background` for `foreground`).
 */
export function pairedSurface(name: string): string {
	if (name === "foreground") return "background";
	return name.replace(/-foreground$/, "");
}
