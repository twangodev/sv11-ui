---
title: Theming
description: Customize svagent-ui components using CSS variables and component-level color props.
---

svagent-ui components follow shadcn-svelte's CSS variable convention. Theming means overriding CSS custom properties such as `--background`, `--foreground`, `--primary`, and `--accent` on `:root` and `.dark`. Most components read these tokens directly, so customizing your palette in one place restyles every component at once.

A handful of visualization components (orb, matrix, waveform) also expose their own color props, since their visual language doesn't map cleanly onto the shadcn token set.

## CSS variables

Tokens are declared in your project's `src/app.css`. The shadcn-svelte CLI wires the standard token set into your project when you initialize it; svagent-ui components reuse those same names.

Colors are expressed in the [OKLCH](https://oklch.com/) color space. The light palette lives on `:root`, the dark palette on `.dark`:

```css title="src/app.css"
:root {
	--radius: 0.625rem;
	--background: oklch(1 0 0);
	--foreground: oklch(0.145 0 0);
	--primary: oklch(0.205 0 0);
	--primary-foreground: oklch(0.985 0 0);
	--accent: oklch(0.97 0 0);
	--accent-foreground: oklch(0.205 0 0);
	--muted: oklch(0.97 0 0);
	--muted-foreground: oklch(0.556 0 0);
	--border: oklch(0.922 0 0);
	--ring: oklch(0.708 0 0);
	/* ...card, popover, secondary, destructive, chart-*, sidebar-* */
}

.dark {
	--background: oklch(0.145 0 0);
	--foreground: oklch(0.985 0 0);
	--primary: oklch(0.922 0 0);
	--primary-foreground: oklch(0.205 0 0);
	/* ... */
}
```

In addition to the standard shadcn-svelte tokens, svagent-ui declares a few documentation-oriented variables (`--surface`, `--surface-foreground`, `--code`, `--code-foreground`, `--code-highlight`, `--code-number`) and a brand accent (`--svelte-orange`) used by the docs site. Components themselves do not depend on these.

## Customizing tokens

To recolor components, override the variables in your own `app.css`. For example, to change the primary color:

```css title="src/app.css"
:root {
	--primary: oklch(0.55 0.2 250);
	--primary-foreground: oklch(0.985 0 0);
}

.dark {
	--primary: oklch(0.7 0.18 250);
	--primary-foreground: oklch(0.145 0 0);
}
```

Every component that references `bg-primary` or `text-primary-foreground` updates automatically.

## Component-specific theming

The following components expose dedicated color props because their rendering (WebGL shaders, SVG pixels, canvas bars) doesn't fit the shadcn token model. All other svagent-ui components inherit their colors from the standard tokens above.

### Orb

The orb accepts a `colors` prop — a tuple of two color strings that are fed into the shader as `uColor1` and `uColor2`:

```svelte
<script lang="ts">
	import { Orb } from "$lib/registry/ui/orb";
</script>

<Orb colors={["#CADCFC", "#A0B9D1"]} />
```

The default palette is `["#CADCFC", "#A0B9D1"]`. Any CSS color string accepted by `THREE.Color` works (hex, `rgb(...)`, named colors).

### Matrix

The matrix LED display accepts a `palette` prop with `on` and `off` colors for lit and unlit pixels:

```svelte
<script lang="ts">
	import { Matrix } from "$lib/registry/ui/matrix";
</script>

<Matrix rows={7} cols={7} palette={{ on: "oklch(0.7 0.2 150)", off: "var(--muted-foreground)" }} />
```

The default is `{ on: "currentColor", off: "var(--muted-foreground)" }`, so if you don't pass a palette the lit pixels follow the element's `color`, making the matrix themeable via any Tailwind text utility (`class="text-primary"`, `class="text-destructive"`, etc.).

### Waveform and LiveWaveform

Both `Waveform` and `LiveWaveform` accept an optional `barColor` prop. When omitted, bars are drawn using the canvas's computed `--foreground` value:

```svelte
<script lang="ts">
	import { Waveform } from "$lib/registry/ui/waveform";
	import { LiveWaveform } from "$lib/registry/ui/live-waveform";
</script>

<Waveform data={samples} barColor="oklch(0.55 0.2 250)" />
<LiveWaveform active barColor="var(--primary)" />
```

Because the default resolves from CSS, you can also tint the waveform by setting `color` on a parent element or passing a Tailwind text utility.

## Dark mode

svagent-ui ships with both light and dark palettes out of the box. See [Dark mode](/docs/dark-mode) for how to wire up a theme toggle.

---

For a deeper reference on the underlying token system, see [shadcn-svelte's theming docs](https://shadcn-svelte.com/docs/theming).
