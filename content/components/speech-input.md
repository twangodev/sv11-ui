---
title: Speech Input
description: A compact speech-to-text input component with a provider-agnostic transcription adapter. Ships with a Web Speech API adapter for demos; users supply their own for ElevenLabs Scribe, Deepgram, or other providers.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/speech-input
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
	import {
		SpeechInput,
		SpeechInputRecordButton,
		SpeechInputPreview,
		SpeechInputCancelButton,
	} from "$lib/registry/ui/speech-input";
	import type { TranscriptionAdapter } from "$lib/registry/ui/speech-input";

	const adapter: TranscriptionAdapter = createMyAdapter(/* ... */);
</script>

<SpeechInput
	{adapter}
	onChange={(data) => console.log(data.transcript)}
	onStop={(data) => console.log("Final:", data.transcript)}
>
	<SpeechInputRecordButton />
	<SpeechInputPreview placeholder="Start speaking..." />
	<SpeechInputCancelButton />
</SpeechInput>
```

### With Form Input

Use `onStop` to append the committed transcript onto an external text field.

```svelte
<script lang="ts">
	import {
		SpeechInput,
		SpeechInputRecordButton,
		SpeechInputPreview,
		SpeechInputCancelButton,
	} from "$lib/registry/ui/speech-input";
	import type { TranscriptionAdapter } from "$lib/registry/ui/speech-input";

	const adapter: TranscriptionAdapter = createMyAdapter(/* ... */);
	let value = $state("");
</script>

<div class="flex items-center gap-2">
	<input bind:value class="flex-1 rounded border px-3 py-2" />
	<SpeechInput {adapter} onStop={(data) => (value = `${value} ${data.transcript}`.trim())}>
		<SpeechInputRecordButton />
		<SpeechInputPreview />
		<SpeechInputCancelButton />
	</SpeechInput>
</div>
```

### Reversed Layout

Child order is the layout order — put the cancel button first if you want it to lead.

```svelte
<SpeechInput {adapter}>
	<SpeechInputCancelButton />
	<SpeechInputPreview />
	<SpeechInputRecordButton />
</SpeechInput>
```

### Minimal (Record Button Only)

Drop the preview and cancel slots for an icon-only recorder; the transcript is still delivered via `onStop`.

```svelte
<SpeechInput {adapter} onStop={(data) => console.log(data.transcript)}>
	<SpeechInputRecordButton />
</SpeechInput>
```

### Custom Placeholder

`SpeechInputPreview` shows its `placeholder` text until the first partial transcript arrives.

```svelte
<SpeechInput {adapter}>
	<SpeechInputRecordButton />
	<SpeechInputPreview placeholder="Say something..." />
	<SpeechInputCancelButton />
</SpeechInput>
```

### Using the Hook

`useSpeechInput()` reads the context set up by `SpeechInput.Root`, so child components can render their own UI against the shared state.

```svelte
<script lang="ts">
	import { useSpeechInput } from "$lib/registry/ui/speech-input";

	const state = useSpeechInput();
</script>

<p>
	Status: {state.isConnecting ? "Connecting" : state.isConnected ? "Recording" : "Idle"}
</p>
<p>Transcript: {state.transcript}</p>
```

## API Reference

<ComponentAPI component="speech-input" />

## Notes

- The component is a compound primitive — `SpeechInput.Root` wires context and the adapter; `SpeechInputRecordButton`, `SpeechInputPreview`, and `SpeechInputCancelButton` read that context. Sub-components must be rendered inside a root or their `useSpeechInput()` call will throw.
- The adapter reference is stored as a plain private field (not reactive) — swapping adapters mid-recording is unsupported and takes effect on the next `start()`.
- An internal request-id invalidates late callbacks, so a `stop()` or `cancel()` during connection reliably wins even if the adapter's `onConnect` fires after.
- `stop()` preserves the in-flight partial transcript and forwards it to `onStop`; `cancel()` clears partial + committed state before firing `onCancel`. Choose based on whether the user is committing or discarding the utterance.
- Teardown uses `onDestroy` rather than `$effect` cleanup so dev-mode HMR and parent re-renders do not cancel an active recording.
- The record button is disabled while `state.isConnecting`; the cancel button is inert unless `state.isConnected`.
