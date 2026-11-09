---
title: ElevenLabs
description: Wrap the @elevenlabs/client SDK in a ConversationAdapter.
---

Install the optional adapter. It installs `@elevenlabs/client` and the shared voice-session files; ordinary UI installs do not include this SDK.

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/adapter-elevenlabs.json
```

## Conversations

```svelte
<script lang="ts">
	import { onDestroy } from "svelte";
	import { createConversationSession } from "$lib/components/ui/voice-session";
	import { createElevenLabsConversation } from "$lib/components/ui/voice-session/adapters/elevenlabs";
	import { ConversationBar } from "$lib/components/ui/conversation-bar";

	const adapter = createElevenLabsConversation(async () => {
		const response = await fetch("/api/conversation-token");
		if (!response.ok) throw new Error("Could not authorize this conversation.");
		const { token } = await response.json();
		return { conversationToken: token, connectionType: "webrtc" };
	});
	const session = createConversationSession(adapter);
	onDestroy(() => {
		void session.dispose();
	});
</script>

<ConversationBar {session} />
```

The factory runs for every connection, so tokens can refresh. Your authenticated backend requests the conversation token using its ElevenLabs API key. A WebSocket setup can instead return `{ signedUrl }`. Public agents can return `{ agentId: "your-agent-id" }`.

Pass this same `session` to any `VoiceChat01`, `VoiceChat02`, `VoiceChat03`, or `MicSelector`. Controls share messages, mute state, device selection, and SDK audio meters. A component given an `adapter` directly owns and disposes its local session; a component given a `session` leaves disposal to its creator.

Native configuration, including client tools and SDK callbacks, belongs in the factory result. The adapter forwards lifecycle, messages and mode changes into the common session. `getInputVolume` and `getOutputVolume` use the SDK's meters; the UI does not open another microphone for its waveform.

## Realtime transcription

```svelte
<script lang="ts">
	import * as SpeechInput from "$lib/components/ui/speech-input";
	import { createElevenLabsTranscription } from "$lib/components/ui/voice-session/adapters/elevenlabs";

	const adapter = createElevenLabsTranscription({
		getToken: async () => {
			const response = await fetch("/api/scribe-token");
			if (!response.ok) throw new Error("Could not authorize transcription.");
			return (await response.json()).token;
		},
	});
</script>

<SpeechInput.Root {adapter} onStop={({ transcript }) => console.log(transcript)}>
	<SpeechInput.RecordButton />
	<SpeechInput.Preview />
	<SpeechInput.CancelButton />
</SpeechInput.Root>
```

The backend mints a single-use Scribe token. The default configuration uses microphone input, `scribe_v2_realtime`, and VAD commits. Supply `scribe` to configure native options such as language, device, VAD thresholds, or manual PCM input. Native enum values can be imported from `@elevenlabs/client`.

The adapter also works with `RealtimeTranscriber01`. `stop()` waits for an outstanding partial transcript to finalize before closing; `cancel()` immediately discards pending work. A finalization timeout is surfaced as an error. `commit()` and `sendAudio()` are available for manual-mode consumers.

See the [conversation SDK](https://elevenlabs.io/docs/eleven-agents/libraries/java-script) and [Scribe SDK](https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/javascript-scribe) for backend token setup and native options. The sv11 documentation site is static; these endpoints belong in the application using the components.
