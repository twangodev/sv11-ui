---
title: Conversation
description: A scroll-aware chat container that auto-sticks to the bottom as new messages stream in.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/conversation
---

<ComponentPreview name="conversation-demo" />

## Installation

<Install component="conversation" />

## Usage

<Usage component="conversation" />

## Examples

### Basic Usage

Wrap your message list in `Conversation.Root` and `Conversation.Content`. Include `Conversation.ScrollButton` to give users a way back to the latest turn after they scroll up.

```svelte
<script lang="ts">
	import * as Conversation from "$lib/registry/ui/conversation";

	type Turn = { id: string; content: string };
	let messages: Turn[] = $state([]);
</script>

<Conversation.Root>
	<Conversation.Content>
		{#each messages as message (message.id)}
			<div>{message.content}</div>
		{/each}
	</Conversation.Content>
	<Conversation.ScrollButton />
</Conversation.Root>
```

### With Empty State

Render `Conversation.EmptyState` when the message list is empty. It accepts `title`, `description`, and an `icon` snippet.

```svelte
<script lang="ts">
	import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
	import * as Conversation from "$lib/registry/ui/conversation";

	type Turn = { id: string; content: string };
	let messages: Turn[] = $state([]);
</script>

<Conversation.Root>
	<Conversation.Content>
		{#if messages.length === 0}
			<Conversation.EmptyState
				title="No messages yet"
				description="Start a conversation to see messages here"
			>
				{#snippet icon()}
					<MessageCircleIcon class="size-12" />
				{/snippet}
			</Conversation.EmptyState>
		{:else}
			{#each messages as message (message.id)}
				<div>{message.content}</div>
			{/each}
		{/if}
	</Conversation.Content>
	<Conversation.ScrollButton />
</Conversation.Root>
```

## API Reference

<ComponentAPI component="conversation" />

## Notes

- Built on [`stick-to-bottom-svelte`](https://www.npmjs.com/package/stick-to-bottom-svelte) for smooth scroll anchoring.
- Automatically stays pinned to the bottom as new content is appended, unless the user has scrolled up.
- `Conversation.ScrollButton` only appears when the user is not at the bottom. It calls `scrollToBottom()` on the parent context.
- `Conversation.EmptyState` accepts either strings or `Snippet`s for `title` and `description`, plus a separate `icon` snippet. Passing `children` overrides the entire default layout.
- Sub-components (`Content`, `ScrollButton`, `EmptyState`) read the parent context and will throw if used outside `Conversation.Root`.
- Pair with [`Message`](/docs/components/message) for styled user/assistant turns, or render any custom markup inside `Conversation.Content`.
