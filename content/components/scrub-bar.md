---
title: Scrub Bar
description: An audio timeline scrubber with progress, draggable thumb, and time labels.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/scrub-bar
---

<ComponentPreview name="scrub-bar-demo" />

## Installation

<Install component="scrub-bar" />

## Usage

<Usage component="scrub-bar" />

## Examples

### Basic Usage

Compose `Root`, `Track`, `Progress`, `Thumb`, and `TimeLabel` to build a standard scrub bar.

```svelte
<script lang="ts">
	import * as ScrubBar from "$lib/registry/ui/scrub-bar";

	let value = $state(30);
	const duration = 100;
</script>

<ScrubBar.Root {duration} {value} onScrub={(t) => (value = t)}>
	<ScrubBar.TimeLabel time={value} />
	<ScrubBar.Track class="mx-2">
		<ScrubBar.Progress />
		<ScrubBar.Thumb />
	</ScrubBar.Track>
	<ScrubBar.TimeLabel time={duration} />
</ScrubBar.Root>
```

### Scrub Start and End

Wire `onScrubStart` and `onScrubEnd` to pause playback while the user drags the thumb, then resume on release.

```svelte
<script lang="ts">
	import * as ScrubBar from "$lib/registry/ui/scrub-bar";

	let value = $state(30);
	let isScrubbing = $state(false);
	const duration = 100;
</script>

<ScrubBar.Root
	{duration}
	{value}
	onScrub={(t) => (value = t)}
	onScrubStart={() => (isScrubbing = true)}
	onScrubEnd={() => (isScrubbing = false)}
>
	<ScrubBar.TimeLabel time={value} />
	<ScrubBar.Track class="mx-2">
		<ScrubBar.Progress />
		<ScrubBar.Thumb data-scrubbing={isScrubbing} />
	</ScrubBar.Track>
	<ScrubBar.TimeLabel time={duration} />
</ScrubBar.Root>
```

### Custom Time Format

Pass a `format` function to `TimeLabel` to render time in your preferred format. The default is `m:ss`.

```svelte
<script lang="ts">
	import * as ScrubBar from "$lib/registry/ui/scrub-bar";

	function formatHMS(time: number) {
		const hours = Math.floor(time / 3600);
		const minutes = Math.floor((time % 3600) / 60);
		const seconds = Math.floor(time % 60);
		return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}

	let value = $state(125);
	const duration = 3720;
</script>

<ScrubBar.Root {duration} {value} onScrub={(t) => (value = t)}>
	<ScrubBar.TimeLabel time={value} format={formatHMS} />
	<ScrubBar.Track class="mx-2">
		<ScrubBar.Progress />
		<ScrubBar.Thumb />
	</ScrubBar.Track>
	<ScrubBar.TimeLabel time={duration} format={formatHMS} />
</ScrubBar.Root>
```

## API Reference

<ComponentAPI component="scrub-bar" />

## Notes

- `ScrubBar.Root` publishes context via `setScrubBarContext`; sub-components (`Track`, `Progress`, `Thumb`) must be rendered inside it or they will throw.
- `Track` handles pointer events directly on `window` once a drag starts, so dragging outside the track still updates the value until pointer-up.
- Scrubbing is driven by pointer coordinates clamped to the track's bounding rect, so the resulting time is always within `[0, duration]`.
- `Progress` wraps the shared `Progress` primitive and forwards its props, except `value` — which is supplied by context.
- `Thumb` positions itself with an inline `left: <progress>%` style; restyle via `class` rather than overriding `left` directly.
- `TimeLabel` uses `tabular-nums` so digits do not shift as the current time updates.
