---
title: Bar Visualizer
description: Audio frequency band visualizer with agent state animations. Renders a row of animated bars driven by a MediaStream via Web Audio's AnalyserNode, with built-in demo mode.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/bar-visualizer
---

<ComponentPreview name="bar-visualizer-demo" />

## Installation

<Install component="bar-visualizer" />

## Usage

<Usage component="bar-visualizer" />

## Examples

### Basic Usage

Pipe a live `MediaStream` into the visualizer. The FFT slice is analysed on every frame and mapped onto `barCount` bars.

```svelte
<script lang="ts">
	import { BarVisualizer } from "$lib/registry/ui/bar-visualizer";

	let stream: MediaStream | null = $state(null);
</script>

<BarVisualizer state="listening" barCount={15} mediaStream={stream} />
```

### Demo Mode

Set `demo` to swap live audio for a synthetic oscillating pattern. Handy for previews where no microphone is available.

```svelte
<BarVisualizer state="speaking" demo centerAlign />
```

### Agent State

Drive the highlight sequence and animation cadence from an agent lifecycle value. `"thinking"` pulses, `"connecting"` sweeps, `"listening"` and `"speaking"` emphasise the active bars.

```svelte
<script lang="ts">
	import { BarVisualizer, type AgentState } from "$lib/registry/ui/bar-visualizer";

	let state: AgentState = $state("connecting");
</script>

<BarVisualizer {state} demo />
```

### Height Range

Tune the usable vertical band by adjusting `minHeight` and `maxHeight` (both percentages of the container).

```svelte
<BarVisualizer state="speaking" demo minHeight={15} maxHeight={90} />
```

## API Reference

<ComponentAPI component="bar-visualizer" />

## Notes

- Analysis uses a Web Audio `AnalyserNode` with `fftSize: 2048`, sampling a mid-range slice of the spectrum and averaging each chunk into a bar.
- `demo` overrides `mediaStream` — the synthetic pattern is always active when `demo` is `true`, regardless of stream.
- The state sequencer runs independently of volume sampling, so `state` animates even without audio input.
- Bars update on `requestAnimationFrame` with a throttled diff check (changes under `0.01` are ignored) to minimise re-renders.
- `centerAlign` swaps the flex alignment from `items-end` to `items-center`, growing bars equally above and below the midline.
