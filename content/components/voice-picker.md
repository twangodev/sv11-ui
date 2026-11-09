---
title: Voice Picker
description: A searchable voice selector with audio preview and Orb visualization. Provider-agnostic — pass any voices matching the Voice interface from ElevenLabs, OpenAI, Cartesia, or a custom backend.
component: true
links:
  source: https://github.com/twangodev/sv11-ui/tree/main/src/lib/registry/ui/voice-picker
---

<ComponentPreview name="voice-picker-demo" />

## Installation

<Install component="voice-picker" />

## Usage

<Usage component="voice-picker" />

## Examples

### Basic Usage

Pass an array of `Voice` objects and bind `value`/`onValueChange` to track the selected voice ID.

```svelte
<script lang="ts">
	import { VoicePicker, type Voice } from "$lib/components/ui/voice-picker";

	const voices: Voice[] = [
		{
			id: "21m00Tcm4TlvDq8ikWAM",
			name: "Rachel",
			previewUrl: "https://example.com/rachel-preview.mp3",
			labels: { accent: "american", gender: "female", age: "young" },
		},
	];

	let selectedVoice = $state("");
</script>

<VoicePicker {voices} value={selectedVoice} onValueChange={(v) => (selectedVoice = v)} />
```

The parent owns selection: update `value` in `onValueChange` to keep the selected voice visible. An `onValueChange` callback alone reports the click without retaining a selected value.

### Control Open State

Pair `open` with `onOpenChange` to drive the popover externally — useful if you want to open the picker from another control.

```svelte
<script lang="ts">
	import { VoicePicker, type Voice } from "$lib/components/ui/voice-picker";

	let { voices }: { voices: Voice[] } = $props();
	let open = $state(false);
	let selectedVoice = $state("");
</script>

<VoicePicker
	{voices}
	{open}
	onOpenChange={(o) => (open = o)}
	value={selectedVoice}
	onValueChange={(v) => (selectedVoice = v)}
/>
```

### Custom Placeholder

Override the trigger text shown before the user selects a voice.

```svelte
<VoicePicker
	{voices}
	placeholder="Choose your voice..."
	value={selectedVoice}
	onValueChange={(v) => (selectedVoice = v)}
/>
```

### Loading Voices from a Provider

Map any provider's voice shape into the `Voice` interface once, then hand the array to `VoicePicker`. Below is a sketch for ElevenLabs — the same pattern applies to OpenAI, Cartesia, or a custom backend.

```svelte
<script lang="ts">
	import { onMount } from "svelte";
	import { VoicePicker, type Voice } from "$lib/components/ui/voice-picker";

	let voices = $state<Voice[]>([]);
	let selectedVoice = $state("");

	onMount(async () => {
		const res = await fetch("/api/voices");
		const data = await res.json();
		voices = data.voices.map((v: { voice_id: string; name: string; preview_url?: string }) => ({
			id: v.voice_id,
			name: v.name,
			previewUrl: v.preview_url,
		}));
	});
</script>

<VoicePicker {voices} value={selectedVoice} onValueChange={(v) => (selectedVoice = v)} />
```

## API Reference

<ComponentAPI component="voice-picker" />

## Notes

- Built on the shadcn-svelte `Command` and `Popover` primitives plus sv11's [`AudioPlayer`](/docs/components/audio-player) — search, keyboard nav, and shared playback state come from those components.
- Each row renders an [`Orb`](/docs/components/orb); the selected voice also shows one on the trigger (hardcoded to the `"thinking"` state, purely decorative).
- Preview playback is driven by `AudioPlayer`, so only one voice plays at a time across the picker.
- Voices without a `previewUrl` still render, but the hover play/pause overlay is suppressed.
- Search filtering draws on each voice's `name` plus the common `labels` keys (`accent`, `gender`, `age`, `description`, `use case`).
- Selection is controlled through `value` and `onValueChange`. The popover manages its own open state unless you provide `open` and `onOpenChange`.
- The `Voice` type is provider-agnostic — see [Providers](/docs/providers#voice) for the canonical contract and how to map your backend onto it.
