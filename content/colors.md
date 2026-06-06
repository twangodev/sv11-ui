---
title: Colors
description: The semantic color tokens sv11-ui components are built on.
---

sv11-ui components are styled entirely with semantic color tokens — the same
[shadcn-svelte](https://shadcn-svelte.com/docs/theming) theming layer — rather
than hard-coded colors. Each token is a CSS variable exposed as a Tailwind color
(e.g. `--primary` → `bg-primary`, `text-primary`), so components adapt
automatically to light/dark mode and any custom theme.

Click a swatch to copy its Tailwind class.

<ColorPalette />

## Using tokens

Reference tokens through Tailwind utilities:

```svelte
<div class="bg-card text-card-foreground border-border rounded-lg border">
	<button class="bg-primary text-primary-foreground">Action</button>
</div>
```

Or directly as CSS variables:

```css
.custom {
	background-color: var(--muted);
	color: var(--muted-foreground);
}
```

## Customizing

Override any token in your global stylesheet to retheme every component at once.
See [Theming](/docs/theming) for the full setup and [Dark Mode](/docs/dark-mode)
for light/dark switching.

```css
:root {
	--primary: oklch(0.55 0.22 264);
	--primary-foreground: oklch(0.98 0 0);
}
```
