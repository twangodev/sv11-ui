---
title: Waveform
description: Canvas-based audio waveform visualization components with recording, playback scrubbing, and microphone input support.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/waveform
---

<ComponentPreview name="waveform-demo" />

## Installation

<Install component="waveform" />

## Usage

<Usage component="waveform" />

## Examples

### Basic Usage

Pass an array of values in `[0, 1]` to render a static bar chart.

```svelte
<script lang="ts">
	import { Waveform } from "$lib/registry/ui/waveform";

	const data = Array.from({ length: 50 }, () => Math.random());
</script>

<Waveform {data} height={100} barWidth={4} barGap={2} />
```

### Scrolling Animation

`ScrollingWaveform` continuously scrolls auto-generated bars from right to left.

```svelte
<script lang="ts">
	import { ScrollingWaveform } from "$lib/registry/ui/waveform";
</script>

<ScrollingWaveform height={80} speed={50} barCount={60} fadeEdges />
```

### Microphone Input

`MicrophoneWaveform` captures live input and renders a symmetric frequency visualization.

```svelte
<script lang="ts">
	import { MicrophoneWaveform } from "$lib/registry/ui/waveform";

	let isRecording = $state(false);
</script>

<MicrophoneWaveform
	active={isRecording}
	height={100}
	sensitivity={1.5}
	onError={(error) => console.error("Microphone error:", error)}
/>
```

### Static Waveform

`StaticWaveform` generates deterministic bars from a seed — useful for placeholders.

```svelte
<script lang="ts">
	import { StaticWaveform } from "$lib/registry/ui/waveform";
</script>

<StaticWaveform bars={40} seed={42} />
```

### Audio Scrubber

`AudioScrubber` turns a waveform into an interactive seek control.

```svelte
<script lang="ts">
	import { AudioScrubber } from "$lib/registry/ui/waveform";

	const data = Array.from({ length: 100 }, () => 0.2 + Math.random() * 0.6);
	let currentTime = $state(0);
	const duration = 100;

	function handleSeek(time: number) {
		currentTime = time;
	}
</script>

<AudioScrubber
	{data}
	{currentTime}
	{duration}
	onSeek={handleSeek}
	height={60}
	barWidth={3}
	barGap={1}
/>
```

### Voice Recorder

`RecordingWaveform` captures mic input, stores the full history, and lets the user scrub through the recording once stopped.

```svelte
<script lang="ts">
	import { RecordingWaveform } from "$lib/registry/ui/waveform";
	import { Button } from "$lib/registry/ui/button";

	let recording = $state(false);
</script>

<div class="space-y-4">
	<RecordingWaveform
		{recording}
		height={100}
		onRecordingComplete={(data) => {
			console.log("Recording complete", data);
		}}
	/>
	<Button onclick={() => (recording = !recording)}>
		{recording ? "Stop" : "Start"} Recording
	</Button>
</div>
```

### Live Microphone with Playback

`LiveMicrophoneWaveform` pairs a scrolling live feed with post-recording scrub-and-playback.

```svelte
<script lang="ts">
	import { LiveMicrophoneWaveform } from "$lib/registry/ui/waveform";

	let active = $state(false);
</script>

<LiveMicrophoneWaveform {active} enableAudioPlayback playbackRate={1} />
```

## API Reference

<ComponentAPI component="waveform" />

## Notes

- All variants render to HTML5 Canvas and drive animations with `requestAnimationFrame` for smooth 60fps updates.
- Bar color defaults to the computed `--foreground` CSS variable — override via `barColor` to break out of the theme.
- Canvas sizing is handled internally via `ResizeObserver` and accounts for `devicePixelRatio` on high-DPI displays.
- Microphone-backed variants (`MicrophoneWaveform`, `RecordingWaveform`, `LiveMicrophoneWaveform`) request user permission when their `active` / `recording` prop becomes `true` and release the stream when it flips back to `false`.
- `AudioScrubber` only updates its internal position from `currentTime` while the user is not dragging — local state takes over during interaction to avoid feedback loops.
- `ScrollingWaveform` synthesizes data when `data` is empty; pass values to drive it from your own source.
