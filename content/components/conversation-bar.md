---
title: Conversation Bar
description: A compact conversation input bar with voice and text modes. Provider-agnostic — pass a ConversationAdapter wired to ElevenLabs, OpenAI Realtime, or any voice/chat backend.
component: true
links:
  source: https://github.com/twangodev/sv11-ui/tree/main/src/lib/registry/ui/conversation-bar
---

<ComponentPreview name="conversation-bar-demo" />

## Installation

<Install component="conversation-bar" />

## Usage

<Usage component="conversation-bar" />

`<ConversationBar>` accepts either a shared `session` or an `adapter` from which it creates its own session. See [Providers](/docs/providers#shared-conversation-sessions) for ownership and [Adapters](/docs/adapters) for provider recipes. Without either, it renders disconnected and reports an error if a connection is requested.

## Examples

### Basic Usage

Pass any object that matches `ConversationAdapter` and wire up the lifecycle callbacks you care about.

```svelte
<script lang="ts">
	import { ConversationBar } from "$lib/components/ui/conversation-bar";
	import type { ConversationAdapter } from "$lib/components/ui/conversation-bar";

	const adapter: ConversationAdapter = createMyAdapter(/* ... */);
</script>

<ConversationBar
	{adapter}
	onConnect={() => console.log("Connected")}
	onDisconnect={() => console.log("Disconnected")}
	onMessage={(message) => console.log("Message:", message)}
	onError={(error) => console.error("Error:", error)}
/>
```

### Custom Styling

Merge extra classes onto the container with `class`, and onto the inner waveform container with `waveformClassName`.

```svelte
<ConversationBar
	{adapter}
	class="max-w-2xl"
	waveformClassName="bg-gradient-to-r from-blue-500 to-purple-500"
/>
```

### Custom Disconnected Label

Replace the placeholder text shown in the waveform slot while the session is idle.

```svelte
<ConversationBar {adapter} disconnectedText="Tap to call support" />
```

### Sharing a Session and Transcript

Read the session snapshot when rendering messages. Stable IDs let interim/final updates replace one utterance instead of appending duplicate rows. The parent owns this session and disposes it when the parent is destroyed.

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

<ConversationBar {session} />
{#each conversation.snapshot.messages as message (message.id)}
	<p>{message.source}: {message.message}</p>
{/each}
```

## API Reference

<ComponentAPI component="conversation-bar" />

## Notes

- Passing an `adapter` creates a component-owned session. Passing a `session` subscribes to shared state and leaves disposal to its creator, so unmounting one control does not end another control's conversation.
- `onMessage` observes adapter messages, including interim/final replacements. It does not report every local transcript change; use `session.snapshot.messages` for the complete current transcript.
- Text input sends contextual updates while connected when that capability is supported; `Enter` sends a message and shift-enter inserts a newline.
- The waveform samples the session's meter while connected and unmuted. It does not acquire another microphone.
- Unsupported mute or text operations are disabled according to the adapter's capabilities. Errors are available through the session and `onError`.
