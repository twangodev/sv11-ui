---
title: LiveKit
description: Connect LiveKit Agents with shared session controls and modern transcription streams.
---

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/adapter-livekit.json
```

```svelte
<script lang="ts">
	import { onMount } from "svelte";
	import { createLiveKitConversation } from "$lib/components/ui/voice-session/adapters/livekit";
	import {
		createConversationSession,
		type ConversationSession,
	} from "$lib/components/ui/voice-session";
	import { ConversationBar } from "$lib/components/ui/conversation-bar";

	let session = $state.raw<ConversationSession>();
	onMount(() => {
		const adapter = createLiveKitConversation({
			connect: async () => {
				const response = await fetch("/api/livekit-token");
				if (!response.ok) throw new Error("Could not authorize this room.");
				return response.json(); // { url, token }
			},
		});
		session = createConversationSession(adapter);
		return () => {
			void session?.dispose();
		};
	});
</script>

{#if session}<ConversationBar {session} />{/if}
```

Your backend creates a room access token and dispatches/configures the agent. The client adapter owns a dedicated room connection, microphone controls, and remote audio playback. Pass `room` to supply a room with custom SDK options. Supply `agentIdentity` when selecting among multiple agents.

The adapter receives `lk.transcription` and `lk.chat` text streams. Interim and final streams are reconciled using the participant, transcribed track, and stable segment ID, so an utterance is updated rather than duplicated. Agent activity comes from `lk.agent.state`; meters use participant audio levels.

Out-of-band context and explicit interruption require your application's server protocol. Provide `updateContext(room, text)` and/or `interrupt(room)` callbacks, typically using application-defined RPC. These capabilities are marked unsupported when no callback is supplied; the adapter does not misrepresent a normal chat message as a contextual update.

The adapter registers handlers for these two text-stream topics, so use a room dedicated to this session. It removes its listeners and audio elements when disconnected. See [LiveKit text and transcriptions](https://docs.livekit.io/agents/multimodality/text/) for the agent-side configuration.
