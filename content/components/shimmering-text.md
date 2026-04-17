---
title: Shimmering Text
description: An animated shimmering text effect, ideal for loading and "thinking" states.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/shimmering-text
---

<ComponentPreview name="shimmering-text-demo" />

## Installation

<Install component="shimmering-text" />

## Usage

<Usage component="shimmering-text" />

## Examples

### Basic Usage

Pass any string to `text` and the shimmer begins as soon as the element enters the viewport.

```svelte
<script lang="ts">
	import { ShimmeringText } from "$lib/registry/ui/shimmering-text";
</script>

<ShimmeringText text="Hello, World!" />
```

### Custom Duration and Colors

Slow the sweep down with `duration` and override the gradient with `color` (base) and `shimmerColor` (highlight).

```svelte
<ShimmeringText text="Custom Shimmer" duration={3} color="#6B7280" shimmerColor="#3B82F6" />
```

### Trigger on Viewport Entry

Set `once` to `true` so the animation fires a single time when the element scrolls into view.

```svelte
<ShimmeringText text="Appears when scrolled into view" startOnView once />
```

### Repeating Animation

Control the repeat loop with `repeat` and `repeatDelay`.

```svelte
<ShimmeringText text="Repeating Shimmer" repeat repeatDelay={1} duration={2} />
```

### With Custom Styling

Merge Tailwind utilities through `class` and widen the highlight with `spread`.

```svelte
<ShimmeringText text="Large Heading" class="text-4xl font-bold" spread={3} />
```

## API Reference

<ComponentAPI component="shimmering-text" />

## Notes

- Built on [Motion](https://motion.dev/) — uses `animate` for the sweep and `inView` for viewport detection.
- The shimmer is a CSS gradient painted over the text via `background-clip: text`, so it inherits font weight, kerning, and line-height from surrounding styles.
- Spread scales with text length (`text.length * spread` pixels) so short and long strings read consistently.
- `color` and `shimmerColor` set the `--base-color` and `--shimmer-color` custom properties; leaving them unset falls back to `var(--muted-foreground)` and `var(--foreground)`, which already track light/dark mode.
- When `startOnView` is `true` and `once` is `false`, the animation resumes each time the element re-enters the viewport.
- The element is rendered as an inline `<span>`, so it composes with surrounding text nodes.
