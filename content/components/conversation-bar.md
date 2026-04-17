---
title: Conversation Bar
description: A compact conversation input bar with voice and text modes. Provider-agnostic — pass a ConversationAdapter wired to ElevenLabs, OpenAI Realtime, or any voice/chat backend.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/conversation-bar
---

<ComponentPreview name="conversation-bar-demo" />

## Installation

<Install component="conversation-bar" />

## Usage

<Usage component="conversation-bar" />

`<ConversationBar>` requires an `adapter` prop — see [Providers](/docs/providers#conversationadapter) for the interface and [Adapters](/docs/adapters) for provider recipes.

## Examples

### Basic Usage

Pass any object that matches `ConversationAdapter` and wire up the lifecycle callbacks you care about.

```svelte
<script lang="ts">
	import { ConversationBar } from "$lib/registry/ui/conversation-bar";
	import type { ConversationAdapter } from "$lib/registry/ui/conversation-bar";

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

### Collecting Messages

Accumulate the incoming `ConversationMessage` stream into reactive state — handy for pairing `ConversationBar` with a transcript or chat view.

```svelte
<script lang="ts">
	import { ConversationBar } from "$lib/registry/ui/conversation-bar";
	import type { ConversationAdapter, ConversationMessage } from "$lib/registry/ui/conversation-bar";

	const adapter: ConversationAdapter = createMyAdapter(/* ... */);
	let messages: ConversationMessage[] = $state([]);
</script>

<ConversationBar {adapter} onMessage={(m) => (messages = [...messages, m])} />
```

## API Reference

<ComponentAPI component="conversation-bar" />

## Notes

- Every method on `ConversationAdapter` is driven from user interaction: the mic, keyboard, phone, and send buttons call `setMuted`, `sendContextualUpdate`, `disconnect`/`connect`, and `sendMessage` respectively.
- The component tracks an internal `sessionId` so late callbacks from a prior `connect()` are ignored — swapping adapters or rapid connect/disconnect cycles cannot leak stale state into the UI.
- Text input fires `sendContextualUpdate(text)` on every keystroke while the keyboard is open, and `sendMessage(text)` on `Enter` (shift-enter inserts a newline). Adapters that do not implement contextual updates can make `sendContextualUpdate` a no-op.
- The waveform visualizes the active microphone stream while `connected && !muted`. The mic, keyboard, and end-call buttons are disabled outside the `connected` state.
- `onDestroy` calls `adapter.disconnect()` if a session is still active, so unmounting the component always releases the underlying resources.
- `adapter` is a required prop on `ConversationBarProps`, so TypeScript will flag its omission at compile time. At runtime, pressing the phone button without an adapter would throw from `connect()` — the demo on this page uses a stub adapter that always rejects there to illustrate the `onError` path.
