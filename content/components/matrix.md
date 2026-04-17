---
title: Matrix
description: Retro dot-matrix LED display with circular cells and smooth animations. Supports static patterns, animated frame sequences, and VU meter mode.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/matrix
---

<ComponentPreview name="matrix-demo" />

## Installation

<Install component="matrix" />

## Usage

<Usage component="matrix" />

## Examples

### Static Pattern

Render a single frame by passing `pattern`. The built-in `digits` preset ships as a `Frame[]` indexed by numeral.

```svelte
<script lang="ts">
	import { Matrix, digits } from "$lib/registry/ui/matrix";
</script>

<Matrix rows={7} cols={5} pattern={digits[5]} ariaLabel="Number five" />
```

### Animated Display

Pass a `Frame[]` to `frames` and the matrix steps through them at `fps`.

```svelte
<script lang="ts">
	import { Matrix, wave } from "$lib/registry/ui/matrix";
</script>

<Matrix rows={7} cols={7} frames={wave} fps={20} loop ariaLabel="Wave animation" />
```

### VU Meter

Set `mode="vu"` and pass per-column `levels` in `[0, 1]`. Each column fills from the bottom.

```svelte
<Matrix
	rows={7}
	cols={12}
	mode="vu"
	levels={[0.1, 0.6, 0.9, 0.7, 0.4, 0.8, 0.5, 0.3, 0.6, 0.9, 0.5, 0.2]}
/>
```

### Custom Pattern

Hand-author a `Frame` (a 2D array of brightness values) for bespoke glyphs.

```svelte
<script lang="ts">
	import { Matrix, type Frame } from "$lib/registry/ui/matrix";

	const heart: Frame = [
		[0, 1, 1, 0, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1],
		[0, 1, 1, 1, 1, 1, 0],
		[0, 0, 1, 1, 1, 0, 0],
		[0, 0, 0, 1, 0, 0, 0],
	];
</script>

<Matrix
	rows={6}
	cols={7}
	pattern={heart}
	size={14}
	gap={2}
	palette={{ on: "hsl(0 84% 60%)", off: "hsl(0 84% 20%)" }}
/>
```

### Custom Palette

Swap the `on` / `off` colors to theme the display. Classic phosphor green:

```svelte
<Matrix
	rows={7}
	cols={7}
	frames={wave}
	fps={20}
	palette={{ on: "hsl(142 76% 36%)", off: "hsl(142 76% 10%)" }}
/>
```

### Frame Change Callback

`onFrame` fires whenever the active frame index advances, useful for syncing external UI.

```svelte
<script lang="ts">
	import { Matrix, loader } from "$lib/registry/ui/matrix";

	let currentFrame = $state(0);
</script>

<Matrix rows={7} cols={7} frames={loader} fps={12} onFrame={(i) => (currentFrame = i)} />
<p>Frame: {currentFrame}</p>
```

### Live VU Meter

Feed `levels` from reactive state to animate the meter at render time.

```svelte
<script lang="ts">
	import { Matrix } from "$lib/registry/ui/matrix";

	let levels = $state<number[]>(Array(12).fill(0));

	$effect(() => {
		const id = setInterval(() => {
			levels = Array.from({ length: 12 }, () => Math.random());
		}, 50);
		return () => clearInterval(id);
	});
</script>

<Matrix rows={7} cols={12} mode="vu" {levels} size={10} gap={2} />
```

### Custom Animation

Build an animation by supplying your own frame array.

```svelte
<script lang="ts">
	import { Matrix, type Frame } from "$lib/registry/ui/matrix";

	const frames: Frame[] = [
		[
			[1, 0, 1],
			[0, 1, 0],
			[1, 0, 1],
		],
		[
			[0, 1, 0],
			[1, 0, 1],
			[0, 1, 0],
		],
	];
</script>

<Matrix rows={3} cols={3} {frames} fps={2} loop />
```

## API Reference

<ComponentAPI component="matrix" />

## Notes

- Ships with built-in presets: `digits`, `loader`, `pulse`, `snake`, `wave`, `chevronLeft`, `chevronRight`, and a `vu()` helper for generating VU frames from level arrays.
- A `Frame` is `number[][]` indexed as `[row][col]`, with brightness in `[0, 1]`. Frames smaller than `rows` x `cols` are padded with zeros via the internal `ensureFrameSize` helper.
- When `pattern` is set, animation is disabled regardless of `frames`, `autoplay`, or `loop`.
- `mode="vu"` takes precedence over both `pattern` and `frames` when `levels` is non-empty.
- Animation uses a fixed-timestep accumulator on `requestAnimationFrame`, keeping frame cadence stable under variable paint rates.
- Cells render as SVG `<circle>` elements with a gradient fill plus a Gaussian-blur glow filter on active pixels.
- The container advertises `role="img"` plus `aria-live="polite"` while animating, and uses the provided `ariaLabel` (falling back to `"matrix display"`).
