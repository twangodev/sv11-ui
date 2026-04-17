---
title: Audio Player
description: A composable audio playback component with play/pause, seek, time display, and playback speed controls.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/audio-player
---

<ComponentPreview name="audio-player-demo" />

## Installation

<Install component="audio-player" />

## Usage

<Usage component="audio-player" />

```svelte
<script lang="ts">
	import * as AudioPlayer from "$lib/registry/ui/audio-player";
</script>

<AudioPlayer.Root>
	<div class="flex items-center gap-4">
		<AudioPlayer.Button />
		<AudioPlayer.Time />
		<AudioPlayer.Progress class="flex-1" />
		<AudioPlayer.Duration />
	</div>
</AudioPlayer.Root>
```

## Examples

### Basic Usage

Pass an `AudioPlayerItem` to `AudioPlayer.Button` via the `item` prop. Activating the button loads and plays that track; the root swaps `src` automatically.

```svelte
<script lang="ts">
	import * as AudioPlayer from "$lib/registry/ui/audio-player";

	const track = {
		id: "track-1",
		src: "/audio/song.mp3",
		data: { title: "My Song", artist: "Artist Name" },
	};
</script>

<AudioPlayer.Root>
	<AudioPlayer.Button item={track} />
	<AudioPlayer.Progress />
</AudioPlayer.Root>
```

### Multiple Tracks

A single `AudioPlayer.Root` can front many tracks. Each per-track `AudioPlayer.Button` only toggles playback for its own item — the shared `Progress`, `Time`, and `Duration` track whatever is currently active.

```svelte
<script lang="ts">
	import * as AudioPlayer from "$lib/registry/ui/audio-player";

	const tracks = [
		{ id: "1", src: "/audio/track1.mp3", data: { title: "Track 1" } },
		{ id: "2", src: "/audio/track2.mp3", data: { title: "Track 2" } },
		{ id: "3", src: "/audio/track3.mp3", data: { title: "Track 3" } },
	];
</script>

<AudioPlayer.Root>
	<div class="space-y-4">
		{#each tracks as track (track.id)}
			<div class="flex items-center gap-4">
				<AudioPlayer.Button item={track} />
				<span class="text-sm">{track.data.title}</span>
			</div>
		{/each}
		<AudioPlayer.Progress class="w-full" />
		<div class="flex gap-2 text-sm">
			<AudioPlayer.Time />
			<span>/</span>
			<AudioPlayer.Duration />
		</div>
	</div>
</AudioPlayer.Root>
```

### Playback Speed

Drop in `AudioPlayer.Speed` for a dropdown picker, or `AudioPlayer.SpeedButtonGroup` for an inline segmented control. Both write to the same shared `playbackRate` and persist across track swaps.

```svelte
<script lang="ts">
	import * as AudioPlayer from "$lib/registry/ui/audio-player";
</script>

<AudioPlayer.Root>
	<div class="flex items-center gap-4">
		<AudioPlayer.Button />
		<AudioPlayer.Time />
		<AudioPlayer.Progress class="flex-1" />
		<AudioPlayer.Duration />
		<AudioPlayer.Speed />
	</div>
	<AudioPlayer.SpeedButtonGroup speeds={[0.5, 1, 1.5, 2]} />
</AudioPlayer.Root>
```

### Custom Controls

`useAudioPlayer()` exposes the underlying state and imperative controls. Use it for bespoke UI — custom transport buttons, jump controls, speed presets — while the root still manages the `<audio>` element. `useAudioPlayer()` calls `getContext` at init time, so it must live in a component rendered inside `<AudioPlayer.Root>`.

```svelte
<!-- CustomControls.svelte -->
<script lang="ts">
	import { useAudioPlayer } from "$lib/registry/ui/audio-player";
	import { Button } from "$lib/registry/ui/button";

	const player = useAudioPlayer();
</script>

<div class="space-y-4">
	<Button onclick={() => (player.isPlaying ? player.pause() : player.play())}>
		{player.isPlaying ? "Pause" : "Play"}
	</Button>

	<Button onclick={() => player.seek(0)}>Restart</Button>

	<Button
		onclick={() => {
			if (player.duration) player.seek(player.duration * 0.5);
		}}
	>
		Jump to 50%
	</Button>

	<Button onclick={() => player.setPlaybackRate(1.5)}>Speed 1.5x</Button>
</div>
```

```svelte
<script lang="ts">
	import * as AudioPlayer from "$lib/registry/ui/audio-player";
	import CustomControls from "./CustomControls.svelte";
</script>

<AudioPlayer.Root>
	<CustomControls />
</AudioPlayer.Root>
```

### Error Handling

The root surfaces the `<audio>` element's `MediaError` through `player.error`. Read it from `useAudioPlayer()` inside a child component to render a fallback when loading fails. Like the custom-controls example above, the fragment must be rendered inside `<AudioPlayer.Root>` so the hook resolves its context.

```svelte
<!-- ErrorBanner.svelte -->
<script lang="ts">
	import * as AudioPlayer from "$lib/registry/ui/audio-player";
	import { useAudioPlayer } from "$lib/registry/ui/audio-player";

	const player = useAudioPlayer();
</script>

{#if player.error}
	<div class="text-red-500">
		Failed to load: {player.activeItem?.src}
		<br />
		Error: {player.error.message}
	</div>
{:else}
	<AudioPlayer.Button />
{/if}
```

```svelte
<script lang="ts">
	import * as AudioPlayer from "$lib/registry/ui/audio-player";
	import ErrorBanner from "./ErrorBanner.svelte";
</script>

<AudioPlayer.Root>
	<ErrorBanner />
</AudioPlayer.Root>
```

## API Reference

In addition to the root, the registry ships `AudioPlayerButton`, `AudioPlayerProgress`, `AudioPlayerTime`, `AudioPlayerDuration`, `AudioPlayerSpeed`, and `AudioPlayerSpeedButtonGroup` — see [source](https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/audio-player) for their props.

<ComponentAPI component="audio-player" />

## Notes

- `AudioPlayer.Root` renders a single hidden `<audio crossorigin="anonymous">` element and shares its state via context, so every sub-component reads the same track.
- A `requestAnimationFrame` loop syncs `currentTime`, `duration`, `readyState`, `networkState`, `paused`, `playbackRate`, and `error` onto the shared state each frame, keeping UI updates smooth even across rapid seeks.
- `AudioPlayer.Button` toggles between the global track and a specific `item`. When `item` is set, the button only shows active/buffering states while that track is the active one.
- `AudioPlayer.Progress` pauses during pointer interaction and resumes after release if playback was active. Pressing space on a focused thumb toggles play/pause instead of nudging the value.
- `AudioPlayer.Speed` uses the dropdown primitive and shows "Normal" for 1x; `AudioPlayer.SpeedButtonGroup` renders a flat row of buttons for a more compact picker.
- Playback rate persists across track swaps: changing tracks preserves the last-set `playbackRate` on the underlying element.
- `useAudioPlayer<TData>()` is generic over the `data` payload carried on each `AudioPlayerItem`, so you get typed access to metadata (titles, artwork, etc.) alongside the `src`.
