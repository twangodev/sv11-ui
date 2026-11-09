---
title: Providers
description: Provider-agnostic adapter interfaces for wiring sv11 components to any backend.
---

sv11 components consume TypeScript adapters and audio tasks. Install an optional [SDK adapter](/docs/adapters) for ElevenLabs, Pipecat, LiveKit, or AI SDK, or implement the same contract for your own backend. Ordinary UI installs do not pull in provider SDKs.

The [voice-session type definitions](https://github.com/twangodev/sv11-ui/blob/main/src/lib/registry/ui/voice-session/types.ts) are the canonical contracts. Import them from your installed registry files instead of copying interface declarations:

```ts
import type {
	ConversationAdapter,
	ConversationConfig,
	TranscriptionAdapter,
	TranscribeAudio,
	ExtractFields,
} from "$lib/components/ui/voice-session";
```

## Shared conversation sessions

`createConversationSession(adapter)` creates one session for a conversation. Pass it as `session` to `ConversationBar`, the voice-chat blocks, and `MicSelector` so controls share messages, connection state, mute/device state, and audio levels.

The creator disposes an externally supplied session when its owning view is destroyed. Individual controls unsubscribe when unmounted. Passing an `adapter` directly instead creates a local session owned by that component. Avoid server-global sessions shared between requests.

`useConversation(() => session)` exposes the session's reactive `snapshot` inside a Svelte component. For example, given an adapter from one of the provider guides:

```svelte
<script lang="ts">
	import { onDestroy } from "svelte";
	import { ConversationBar } from "$lib/components/ui/conversation-bar";
	import {
		createConversationSession,
		useConversation,
		type ConversationAdapter,
	} from "$lib/components/ui/voice-session";

	declare const adapter: ConversationAdapter;
	const session = createConversationSession(adapter);
	const conversation = useConversation(() => session);
	onDestroy(() => {
		void session.dispose();
	});
</script>

<ConversationBar {session} /><p>{conversation.snapshot.status}</p>
```

Use `snapshot.messages` for the complete transcript. A stable message `id` identifies an utterance; later updates replace that message, and `final: false` marks an interim transcript. `subscribeMessages()` and `ConversationBar.onMessage` observe adapter events rather than every snapshot change; appending each event to a separate array would duplicate interim/final versions.

## ConversationAdapter

The adapter owns its transport and media. The shared session owns UI state and coordinates its lifecycle:

- `connect(config)` resolves once the transport and agent are ready; reject authentication, permission, or initialization failures. Report lifecycle, messages, activity, levels, and optional input streams through the supplied callbacks. Observe `config.signal` during startup and release resources granted after cancellation.
- `disconnect()` can be asynchronous. Release the connection, microphone, playback elements, and listeners owned by the adapter.
- `sendMessage(text)` sends a user-authored turn. `sendContextualUpdate(text)` sends context that should not request a direct answer.
- `setMuted(muted)` controls the active microphone. `setInputDevice(deviceId)` switches an input device during a connected session; it does not configure a future connection.
- `interrupt()`, input-device switching, and volume getters are optional. Volume values are normalized to `[0, 1]`.

Declare unsupported `capabilities` explicitly as `false`; the session reports `UnsupportedCapabilityError` for an unsupported operation. Optional adapter methods must exist before their operation can run.

`textMessageOwner` defaults to `"session"`: after `sendMessage` succeeds, the session inserts the submitted text into its transcript. Set it to `"adapter"` when the adapter emits that canonical user turn itself. Use stable IDs for acknowledgements and later revisions; independent received messages are never merged merely because their text is equal. See the [custom adapter guide](/docs/adapters/custom) for a complete bridge.

## TranscriptionAdapter

`SpeechInput` and `RealtimeTranscriber01` use a `TranscriptionAdapter` for streaming speech-to-text:

- `start(callbacks)` resolves when audio can be sent, or rejects when startup fails.
- Emit interim hypotheses through `onPartialTranscript` and finalized phrases through `onCommittedTranscript`.
- `stop()` finalizes pending speech and resolves after delivering the last committed phrase. Components preserve any remaining partial transcript when stopped.
- `cancel()` discards pending work. `SpeechInput` clears its transcript state; its `onCancel` callback receives the snapshot from before clearing.
- Optional `commit()` and `sendAudio()` methods support manual-audio workflows.

A component's `adapter` is fixed for the duration of one recording. A replacement adapter takes effect on the next start.

## Recorded audio tasks

`TranscribeAudio` accepts recorded audio and an optional abort signal, then resolves to text. `ExtractFields<T>` accepts a transcript and signal, then resolves to the fields that should change. Voice forms preserve existing values for fields omitted by the extractor.

The [AI SDK guide](/docs/adapters/ai-sdk) shows server-side transcription and structured extraction composed with browser HTTP helpers. Provider credentials and backend endpoints belong in the consuming application; the sv11 documentation site is static.

## Voice

`VoicePicker` accepts plain provider-neutral voice data. Import `Voice` and `VoiceLabels` from `$lib/components/ui/voice-picker`; their [source definitions](https://github.com/twangodev/sv11-ui/blob/main/src/lib/registry/ui/voice-picker/types.ts) are the reference.

Each voice has an `id` and `name`, with optional `previewUrl`, `description`, and `labels`. Providing `previewUrl` enables the audio preview. Extra label keys are accepted as data; the picker searches the common fields documented on the [VoicePicker page](/docs/components/voice-picker).
