---
title: Providers
description: Provider-agnostic adapter interfaces for wiring sv11 components to any backend.
---

sv11 components consume small TypeScript adapter interfaces. Optional [SDK adapters](/docs/adapters) provide ElevenLabs, Pipecat, LiveKit, and AI SDK integrations. Install the integration you use, or implement the same contract for a custom backend. Ordinary UI installs do not pull in SDKs.

## Shared conversation sessions

`createConversationSession(adapter)` creates one observable session. Pass it as `session` to `ConversationBar`, any voice-chat block, and `MicSelector`. All controls share connection state, transcript updates, mute and device state, and audio levels. The creator disposes an external session when its owning view is destroyed. Passing `adapter` directly creates a local session owned by that component.

The session exposes `snapshot`, `subscribe`, `connect`, `disconnect`, `sendMessage`, `sendContextualUpdate`, `setMuted`, `setInputDevice`, `interrupt`, `getInputVolume`, `getOutputVolume`, `clearMessages`, and `dispose`. Its snapshot contains `status`, `activity`, `messages`, `muted`, `inputDeviceId`, `inputStream`, `inputLevel`, `outputLevel`, and `error`.

`useConversation(() => session)` makes a session's snapshot reactive in a Svelte component. It does not take ownership of an external session. To share state, construct the session in the parent component; do not create a server-global session shared between requests.

Adapters can declare `capabilities` for text, context, mute, input-device switching, explicit interruption, and audio levels. A capability set to `false` is rejected with `UnsupportedCapabilityError`. Controls hide or disable unsupported operations where applicable. Optional adapter methods are required before the corresponding operation can run.

Conversation messages can include a stable `id` and `final` flag. Reusing an ID replaces the previous transcript version; SDK echoes of typed user messages reconcile with pending local turns. Connection callbacks may additionally report activity, levels, or a stream through `onActivityChange`, `onAudioLevels`, and `onInputStream`. `signal` cancels startup.

## ConversationAdapter

Used by [ConversationBar](/docs/components/conversation-bar) to drive real-time agent conversations. Handles the full duplex session lifecycle — connecting, streaming messages in both directions, and muting the microphone.

```ts
export interface ConversationAdapter {
	connect(config: ConversationConfig): Promise<void>;
	disconnect(): void;
	sendMessage(text: string): void;
	sendContextualUpdate(text: string): void;
	setMuted(muted: boolean): void;
}
```

The `config` passed to `connect()` is the callback bundle the adapter fires as the session progresses:

```ts
export interface ConversationConfig {
	onConnect: () => void;
	onDisconnect: () => void;
	onMessage: (message: ConversationMessage) => void;
	onError: (error: Error) => void;
	onStatusChange: (status: AgentConnectionState) => void;
	onModeChange?: (mode: ConversationMode) => void;
}
```

Messages use a simple source-tagged shape:

```ts
export interface ConversationMessage {
	source: "user" | "ai";
	message: string;
}
```

Status and mode are narrow string-literal unions:

```ts
export type AgentConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting";

export type ConversationMode = "speaking" | "listening";
```

### Method responsibilities

- **`connect(config)`** — Open the underlying transport, begin capturing microphone audio, and wire every event from the backend to the matching callback in `config`. Resolve once the session is live; reject on auth, permission, or initialization errors.
- **`disconnect()`** — Tear down the session and release the microphone. Fire `onStatusChange` through `disconnecting` and end with `onDisconnect`.
- **`sendMessage(text)`** — Send a user-authored text turn that the agent should treat as spoken input and respond to.
- **`sendContextualUpdate(text)`** — Send out-of-band context the agent should be aware of but not respond to directly (e.g. page navigation, UI state).
- **`setMuted(muted)`** — Mute or unmute the local microphone without dropping the session.

## TranscriptionAdapter

Used by [SpeechInput](/docs/components/speech-input) to stream speech-to-text. The adapter owns the STT socket and emits partial and committed transcripts as they arrive.

```ts
export interface TranscriptionAdapter {
	/**
	 * Open connection and start capturing audio. Resolves when ready
	 * (i.e. when `onConnect` has fired or the connection is established).
	 * Rejects on authentication, permission, or initialization errors.
	 */
	start(callbacks: TranscriptionAdapterCallbacks): Promise<void>;
	/**
	 * Close the connection cleanly. Any in-flight partial transcript is
	 * preserved by the component and passed to the user's `onStop` callback.
	 */
	stop(): void | Promise<void>;
	/**
	 * Close the connection AND discard any in-flight partial transcript.
	 * The component clears partial + committed state before firing `onCancel`.
	 */
	cancel(): void | Promise<void>;
}
```

```ts
export interface TranscriptionAdapterCallbacks {
	onPartialTranscript?: (text: string) => void;
	onCommittedTranscript?: (text: string) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: Error) => void;
}
```

### Contract details

- **`start()` resolution timing** — The returned promise must only resolve once the connection is actually ready for audio (i.e. after `onConnect` has fired or the transport is confirmed open). Rejection is reserved for authentication, permission, or initialization failures so the component can surface them to the user.
- **`stop()` vs `cancel()`** — `stop()` can be asynchronous: finalize pending speech, deliver its committed transcript, then resolve. The component preserves any remaining partial in `onStop`. `cancel()` discards pending work and clears the component state; `onCancel` receives a snapshot taken before clearing.
- **Partial vs committed** — Call `onPartialTranscript` for interim hypotheses that may still change, and `onCommittedTranscript` once the provider finalizes a segment.

## Voice

Used by [VoicePicker](/docs/components/voice-picker) to render voice selection UIs. This is a plain data shape rather than a behavioral interface — you load voices from your provider and map them onto this type.

```ts
export type Voice = {
	id: string;
	name: string;
	previewUrl?: string;
	description?: string;
	labels?: VoiceLabels;
};

export type VoiceLabels = {
	accent?: string;
	gender?: string;
	age?: string;
	description?: string;
	descriptive?: string;
	"use case"?: string;
	use_case?: string;
	[key: string]: string | undefined;
};
```

Providing `previewUrl` is what enables the built-in audio preview in `VoicePicker` — omit it and the preview control is hidden. `labels` is an open-ended map with a few conventional keys; anything extra on it is still accepted for filtering and display.

## Writing your own adapter

An adapter is any object that matches the interface — there is no base class, no decorator, no registration step. Wrap any SDK (ElevenLabs, OpenAI Realtime, Deepgram, Whisper, the Web Speech API, a custom WebSocket) in a module that exposes the right methods and forwards events to the supplied callbacks. For ready-made recipes per provider, see [/docs/adapters](/docs/adapters).

```svelte
<script lang="ts">
	import { ConversationBar, type ConversationAdapter } from "$lib/registry/ui/conversation-bar";

	declare const adapter: ConversationAdapter;
</script>

<ConversationBar {adapter} />
```
