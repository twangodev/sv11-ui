---
title: Custom
description: Build a ConversationAdapter against your own backend.
---

An adapter is an object conforming to `ConversationAdapter`. It owns transport and media. A `ConversationSession` normalizes its events and makes them shareable across controls.

```ts
import type { ConversationAdapter, ConversationConfig } from "$lib/components/ui/voice-session";

// Example wire protocol for a text-only WebSocket backend.
export function createSocketConversation(url: string): ConversationAdapter {
	let socket: WebSocket | undefined;
	let closePending: (() => void) | undefined;
	return {
		capabilities: {
			text: true,
			context: true,
			mute: false,
			inputDevice: false,
			audioLevels: false,
		},
		connect(config: ConversationConfig) {
			return new Promise<void>((resolve, reject) => {
				const current = (socket = new WebSocket(url));
				closePending = () => {
					current.close();
					resolve();
				};
				config.signal?.addEventListener("abort", closePending, { once: true });
				current.onopen = () => {
					config.onConnect();
					resolve();
				};
				current.onerror = () => {
					const error = new Error("Connection failed.");
					config.onError(error);
					reject(error);
				};
				current.onclose = () => {
					config.onDisconnect();
					resolve();
				};
				current.onmessage = ({ data }) => {
					try {
						const event = JSON.parse(data);
						if (typeof event.id === "string" && typeof event.text === "string") {
							config.onMessage({
								id: event.id,
								source: "ai",
								message: event.text,
								final: event.final !== false,
							});
						}
					} catch {
						config.onError(new Error("Invalid server message."));
					}
				};
			});
		},
		disconnect() {
			closePending?.();
			socket = undefined;
		},
		sendMessage(text) {
			socket?.send(JSON.stringify({ type: "user-message", text }));
		},
		sendContextualUpdate(text) {
			socket?.send(JSON.stringify({ type: "context", text }));
		},
		setMuted() {
			throw new Error("This backend has no microphone.");
		},
	};
}
```

Adapt the example protocol to your server and validate its payloads. Resolve `connect()` only once the transport and agent are ready. When startup is cancelled, settle the promise and release any microphone granted later. Events after disconnect are ignored by the session, but adapters still own cleanup of their underlying SDK resources.

Reuse a stable message ID for interim and final versions of an utterance. Set `final: false` for partial text. By default, `textMessageOwner: "session"` inserts a typed turn after the adapter accepts it. Set `textMessageOwner: "adapter"` if your bridge emits that user turn itself. Correlate acknowledgements by stable ID; equal text alone does not identify the same utterance.

For audio backends, implement `setMuted`, optionally `setInputDevice`, and either `getInputVolume`/`getOutputVolume` or `onAudioLevels`. Mark unsupported capabilities explicitly. `onActivityChange` accepts `idle`, `listening`, `thinking`, or `speaking`. An existing stream can be exposed through `onInputStream`; visualizations should reuse SDK meters or that stream.

For streaming transcription, implement `TranscriptionAdapter`. Deliver interim text through `onPartialTranscript`, finalized phrases through `onCommittedTranscript`, and make `stop()` resolve after the final phrase is delivered. `cancel()` discards pending work. Optional `commit()` and `sendAudio()` support manual audio workflows. The same adapter works in `SpeechInput` and `RealtimeTranscriber01`.
