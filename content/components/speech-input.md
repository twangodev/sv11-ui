---
title: Speech Input
description: A compact speech-to-text input component with a provider-agnostic transcription adapter. Ships with a Web Speech API adapter for demos; users supply their own for ElevenLabs Scribe, Deepgram, or other providers.
component: true
links:
  source: https://github.com/twangodev/sv11-ui/tree/main/src/lib/registry/ui/speech-input
---

<ComponentPreview name="speech-input-demo" />

## Installation

<Install component="speech-input" />

## Usage

<Usage component="speech-input" />

`<SpeechInput>` requires an `adapter` prop — see [Providers](/docs/providers#transcriptionadapter) for the interface and [Adapters](/docs/adapters) for provider recipes.

## Examples

### Basic Usage

Compose `SpeechInput` with the record button, preview, and cancel button. Pass any object that matches `TranscriptionAdapter`.

```svelte
<script lang="ts">
	import * as SpeechInput from "$lib/components/ui/speech-input";
	import type { TranscriptionAdapter } from "$lib/components/ui/speech-input";

	const adapter: TranscriptionAdapter = createMyAdapter(/* ... */);
</script>

<SpeechInput.Root
	{adapter}
	onChange={(data) => console.log(data.transcript)}
	onStop={(data) => console.log("Final:", data.transcript)}
>
	<SpeechInput.RecordButton />
	<SpeechInput.Preview placeholder="Start speaking..." />
	<SpeechInput.CancelButton />
</SpeechInput.Root>
```

### With Form Input

Use `onStop` to append the committed transcript onto an external text field.

```svelte
<script lang="ts">
	import * as SpeechInput from "$lib/components/ui/speech-input";
	import type { TranscriptionAdapter } from "$lib/components/ui/speech-input";

	const adapter: TranscriptionAdapter = createMyAdapter(/* ... */);
	let value = $state("");
</script>

<div class="flex items-center gap-2">
	<input bind:value class="flex-1 rounded border px-3 py-2" />
	<SpeechInput.Root {adapter} onStop={(data) => (value = `${value} ${data.transcript}`.trim())}>
		<SpeechInput.RecordButton />
		<SpeechInput.Preview />
		<SpeechInput.CancelButton />
	</SpeechInput.Root>
</div>
```

### Reversed Layout

Child order is the layout order — put the cancel button first if you want it to lead.

```svelte
<SpeechInput.Root {adapter}>
	<SpeechInput.CancelButton />
	<SpeechInput.Preview />
	<SpeechInput.RecordButton />
</SpeechInput.Root>
```

### Minimal (Record Button Only)

Drop the preview and cancel slots for an icon-only recorder; the transcript is still delivered via `onStop`.

```svelte
<SpeechInput.Root {adapter} onStop={(data) => console.log(data.transcript)}>
	<SpeechInput.RecordButton />
</SpeechInput.Root>
```

### Custom Placeholder

`SpeechInputPreview` shows its `placeholder` text until the first partial transcript arrives.

```svelte
<SpeechInput.Root {adapter}>
	<SpeechInput.RecordButton />
	<SpeechInput.Preview placeholder="Say something..." />
	<SpeechInput.CancelButton />
</SpeechInput.Root>
```

### Using the Hook

`useSpeechInput()` reads the context set up by `SpeechInput.Root`, so child components can render their own UI against the shared state.

```svelte
<script lang="ts">
	import { useSpeechInput } from "$lib/components/ui/speech-input";

	const state = useSpeechInput();
</script>

<p>
	Status: {state.error
		? `Error: ${state.error}`
		: state.isConnecting
			? "Connecting"
			: state.isConnected
				? "Recording"
				: "Idle"}
</p>
<p>Transcript: {state.transcript}</p>
```

## API Reference

<ComponentAPI component="speech-input" />

## Notes

- The component is a compound primitive — `SpeechInput.Root` wires context and the adapter; `SpeechInputRecordButton`, `SpeechInputPreview`, and `SpeechInputCancelButton` read that context. Sub-components must be rendered inside a root or their `useSpeechInput()` call will throw.
- Each recording keeps the adapter it started with. Changing the `adapter` prop applies to the next recording; callback props stay current.
- `stop()` waits for the adapter's final transcript before firing `onStop`, preserving any remaining partial transcript. Stopping during connection cancels startup and fires `onStop` after cleanup.
- `cancel()` immediately clears the displayed transcript and fires `onCancel` with the discarded data, then resolves when adapter cleanup finishes. A new recording waits for that cleanup. Late events from a previous recording cannot change the current transcript.
- Unmounting cancels the active recording and releases its adapter resources.
- The record button is disabled while connecting, stopping, or cancelling. The cancel button is available while connecting, recording, and stopping.
