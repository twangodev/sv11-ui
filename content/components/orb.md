---
title: Orb
description: A 3D animated orb with audio reactivity, custom colors, and agent state visualization built with Three.js.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/orb
---

<ComponentPreview name="orb-demo" />

## Installation

<Install component="orb" />

## Usage

<Usage component="orb" />

## Examples

### Custom Colors

Pass a two-tuple of hex colors to replace the default gradient.

```svelte
<Orb colors={["#FF6B6B", "#4ECDC4"]} />
```

### Audio Reactivity

Sample live input and output volumes every frame by passing `getInputVolume` and `getOutputVolume`. Each should return a normalized value in `[0, 1]`.

```svelte
<script lang="ts">
	import { Orb } from "$lib/registry/ui/orb";

	function getInputVolume() {
		// Return normalized microphone volume between 0 and 1.
		return 0.5;
	}

	function getOutputVolume() {
		// Return normalized agent-output volume between 0 and 1.
		return 0.7;
	}
</script>

<Orb {getInputVolume} {getOutputVolume} />
```

### Custom Seed

Pass a `seed` for a deterministic orb shape — useful when you want a specific look to persist across reloads.

```svelte
<Orb seed={12345} />
```

### Agent State

Drive the orb's visual behavior from an agent lifecycle value. Pass `null` to render the idle state.

```svelte
<script lang="ts">
	import { Orb } from "$lib/registry/ui/orb";
	import type { OrbAgentState } from "$lib/registry/ui/orb";

	let agentState: OrbAgentState = $state(null);
</script>

<Orb {agentState} />
```

### Manual Volume Control

Switch `volumeMode` to `"manual"` and drive reactivity from reactive state instead of live audio streams.

```svelte
<script lang="ts">
	import { Orb } from "$lib/registry/ui/orb";

	let inputVolume = $state(0.5);
	let outputVolume = $state(0.7);
</script>

<Orb volumeMode="manual" manualInput={inputVolume} manualOutput={outputVolume} />
```

## API Reference

<ComponentAPI component="orb" />

## Notes

- Built on [Three.js](https://threejs.org/) and [@threlte/core](https://threlte.xyz/) for performant WebGL rendering from Svelte.
- Pass functions (`getInputVolume` / `getOutputVolume`) for live audio, or `manualInput` / `manualOutput` with `volumeMode="manual"` for direct control. The callbacks take precedence when both are set.
- Reactive props (`colors`, `agentState`) update smoothly — you can animate palette transitions by mutating `$state` without remounting.
- `seed` defaults to a stable per-instance random value, so multiple orbs on the same page render distinct shapes by default.
- Canvas resizing is handled internally — the orb fills its container and re-renders on layout changes.
