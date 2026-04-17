---
title: Live Waveform
description: Real-time canvas-based audio waveform visualizer with microphone input and customizable rendering modes.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/live-waveform
---

<ComponentPreview name="live-waveform-demo" />

## Installation

<Install component="live-waveform" />

## Usage

<Usage component="live-waveform" />

## Examples

### Static Mode

Render a symmetric frequency-band visualization with bars in fixed positions.

```svelte
<script lang="ts">
	import { LiveWaveform } from "$lib/registry/ui/live-waveform";
</script>

<LiveWaveform active mode="static" />
```

### Scrolling Mode

Render the volume average as a timeline that scrolls right-to-left.

```svelte
<script lang="ts">
	import { LiveWaveform } from "$lib/registry/ui/live-waveform";
</script>

<LiveWaveform active mode="scrolling" />
```

### Processing State

`processing` animates a placeholder wave while you wait for audio. The bars ease back to idle when both `active` and `processing` turn off.

```svelte
<script lang="ts">
	import { LiveWaveform } from "$lib/registry/ui/live-waveform";
</script>

<LiveWaveform processing mode="static" />
```

### Custom Styling

Every rendering parameter is a plain prop — adjust bar geometry, color, height, and edge fade inline.

```svelte
<script lang="ts">
	import { LiveWaveform } from "$lib/registry/ui/live-waveform";
</script>

<LiveWaveform
	active
	barWidth={4}
	barHeight={6}
	barGap={2}
	barColor="#3b82f6"
	height={100}
	fadeEdges
/>
```

## API Reference

<ComponentAPI component="live-waveform" />

## Notes

- Uses the Web Audio API via `AnalyserNode` for real-time frequency analysis.
- Automatically requests microphone permission when `active` becomes `true` and tears down the stream and audio context when it flips back to `false`.
- Canvas rendering is HiDPI-aware — internal `ResizeObserver` scales the drawing buffer by `devicePixelRatio`.
- `mode="static"` draws symmetric frequency bars in fixed positions; `mode="scrolling"` maintains a `historySize`-length ring buffer of volume averages that scrolls right-to-left.
- `processing` smoothly crossfades from the last active frame into the synthetic wave, and a fade-out pass clears the canvas when both flags are off.
- `deviceId` selects a specific input via `MediaDeviceInfo.deviceId`; omit to use the default microphone.
- `onStreamReady` / `onStreamEnd` / `onError` are fire-and-forget callbacks for wiring the lifecycle into app state.
