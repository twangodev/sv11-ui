---
title: Pipecat
description: Connect an RTVI-compatible backend through the Pipecat JavaScript client.
---

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/adapter-pipecat.json
```

Install the transport appropriate to your backend separately, such as `@pipecat-ai/small-webrtc-transport` or `@pipecat-ai/daily-transport`. This adapter uses the framework-independent Pipecat client and accepts a dedicated client instance.

```svelte
<script lang="ts">
	import { onMount } from "svelte";
	import { PipecatClient } from "@pipecat-ai/client-js";
	import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
	import { createPipecatConversation } from "$lib/components/ui/voice-session/adapters/pipecat";
	import {
		createConversationSession,
		type ConversationSession,
	} from "$lib/components/ui/voice-session";
	import { ConversationBar } from "$lib/components/ui/conversation-bar";

	let session = $state.raw<ConversationSession>();
	onMount(() => {
		const client = new PipecatClient({ transport: new SmallWebRTCTransport(), enableMic: true });
		const adapter = createPipecatConversation(client, async () => ({
			webrtcUrl: "/api/offer",
		}));
		session = createConversationSession(adapter);
		return () => {
			void session?.dispose();
		};
	});
</script>

{#if session}<ConversationBar {session} />{/if}
```

The connection factory returns the connection parameters expected by your transport and backend. This does not make an arbitrary provider endpoint RTVI-compatible: your server must implement RTVI, commonly using Pipecat.

The adapter maps current `UserInput` and `BotOutput` events to transcript updates, forwards speech/thinking activity and audio levels, applies microphone selection and mute, and attaches remote audio for playback. Text input calls `sendText`. Context updates are unsupported by default: pass an `updateContext(client, text)` callback in the factory's optional third argument to use your application's context protocol. Explicit interruption is marked unsupported; conversational barge-in remains a backend/transport behavior.

Pipecat owns submitted text turns through `textMessageOwner: "adapter"`, using message IDs to correlate its local acknowledgement with later transport events.

Use a dedicated client. The adapter owns its connection, listeners, and remote audio elements, and releases them on disconnect. See [Pipecat's SDK overview](https://docs.pipecat.ai/api-reference/client/js/overview) and [transport documentation](https://docs.pipecat.ai/api-reference/client/js/transports/transport) for connection parameters.
