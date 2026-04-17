---
title: Mic Selector
description: Dropdown for selecting an input audio device with mute toggle and live waveform preview of the selected microphone.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/mic-selector
---

<ComponentPreview name="mic-selector-demo" />

## Installation

<Install component="mic-selector" />

## Usage

<Usage component="mic-selector" />

## Examples

### Basic Usage

Drop the selector in. It auto-selects the first available microphone and manages mute state internally.

```svelte
<script lang="ts">
	import { MicSelector } from "$lib/registry/ui/mic-selector";
</script>

<MicSelector />
```

### Controlled

Bind the selected `deviceId` to local state to react to device changes elsewhere in your UI.

```svelte
<script lang="ts">
	import { MicSelector } from "$lib/registry/ui/mic-selector";

	let selectedDevice = $state("");
</script>

<MicSelector value={selectedDevice} onValueChange={(id) => (selectedDevice = id)} />
```

### With Mute Control

Pair the mute callback with your own mute state so recording controls can react to it.

```svelte
<script lang="ts">
	import { MicSelector } from "$lib/registry/ui/mic-selector";

	let selectedDevice = $state("");
	let isMuted = $state(false);
</script>

<MicSelector
	value={selectedDevice}
	onValueChange={(id) => (selectedDevice = id)}
	muted={isMuted}
	onMutedChange={(m) => (isMuted = m)}
/>
```

### Custom Styling

Pass a `class` to restyle the trigger button.

```svelte
<MicSelector class="w-full max-w-md" />
```

### Using the Hook

The exported `useAudioDevices` hook powers the dropdown and can be reused to render your own UI. Call it from a component's script setup phase — its reactive effects bind to the caller's scope.

```svelte
<script lang="ts">
	import { useAudioDevices } from "$lib/registry/ui/mic-selector";

	const audio = useAudioDevices();
</script>

{#if audio.loading}
	<p>Loading devices...</p>
{:else if audio.error}
	<p>Error: {audio.error}</p>
{:else}
	<ul>
		{#each audio.devices as device (device.deviceId)}
			<li>{device.label}</li>
		{/each}
	</ul>
{/if}
```

## API Reference

<ComponentAPI component="mic-selector" />

## Notes

- The trigger uses the `LiveWaveform` component inside the dropdown to preview the selected microphone in real time.
- On first open, the dropdown calls `navigator.mediaDevices.getUserMedia` to request microphone permission so device labels can be populated.
- The hook re-enumerates devices on `devicechange` events, so hot-plugging a headset updates the list without a refresh.
- Device labels are cleaned of parenthesized metadata (for example `"(Built-in)"`) before being displayed.
- Works in both controlled and uncontrolled modes for `value` and `muted` independently — omit either pair to let the component track state internally.
- The preview waveform only animates while the dropdown is open and the mic is not muted, so an idle selector does not hold an audio stream.
