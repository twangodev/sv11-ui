---
title: Mic Selector
description: Dropdown for selecting an input audio device with mute toggle and live waveform preview of the selected microphone.
component: true
links:
  source: https://github.com/twangodev/sv11-ui/tree/main/src/lib/registry/ui/mic-selector
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
	import { MicSelector } from "$lib/components/ui/mic-selector";
</script>

<MicSelector />
```

### Controlled

Bind the selected `deviceId` to local state to react to device changes elsewhere in your UI.

```svelte
<script lang="ts">
	import { MicSelector } from "$lib/components/ui/mic-selector";

	let selectedDevice = $state("");
</script>

<MicSelector value={selectedDevice} onValueChange={(id) => (selectedDevice = id)} />
```

### With Mute Control

Pair the mute callback with your own mute state so recording controls can react to it.

```svelte
<script lang="ts">
	import { MicSelector } from "$lib/components/ui/mic-selector";

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

### Share Active Session Controls

Pass the same `session` used by your conversation controls to switch the active input and share mute state. Session controls require a connected session and the corresponding adapter capability (`inputDevice` or `mute`). The selector uses the session's audio meter rather than acquiring a preview stream.

```svelte
<MicSelector {session} />
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
	import { useAudioDevices } from "$lib/components/ui/mic-selector";

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

- The dropdown uses `LiveWaveform` to preview local microphone input, or the existing session meter when `session` is supplied.
- Without a session, the first open requests microphone permission so device labels can be populated. A supplied session owns its input permission and media lifecycle.
- The hook re-enumerates devices on `devicechange` events, so hot-plugging a headset updates the list without a refresh.
- Device labels are cleaned of parenthesized metadata (for example `"(Built-in)"`) before being displayed.
- Without a session, `value` and `muted` can be controlled independently; omit either pair for local state. With a session, its device and mute state drive the control.
- The preview waveform only animates while the dropdown is open and the mic is not muted, so an idle selector does not hold an audio stream.
