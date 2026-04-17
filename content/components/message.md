---
title: Message
description: A chat message component with avatar and content slots.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/message
---

<ComponentPreview name="message-demo" />

## Installation

<Install component="message" />

## Usage

<Usage component="message" />

## Examples

### Basic Message

Compose `Message` with `MessageAvatar` and `MessageContent`. The `from` prop drives alignment and which group-scoped styles apply to descendants.

```svelte
<script lang="ts">
	import { Message, MessageAvatar, MessageContent } from "$lib/registry/ui/message";
</script>

<Message from="user">
	<MessageAvatar src="/user-avatar.jpg" name="John" />
	<MessageContent>Hello, how can I help you?</MessageContent>
</Message>

<Message from="assistant">
	<MessageAvatar src="/assistant-avatar.jpg" name="AI" />
	<MessageContent>I'm here to assist you with any questions!</MessageContent>
</Message>
```

### Message Variants

`MessageContent` accepts a `variant` prop. The default `"contained"` gives each message a filled bubble; `"flat"` drops the background on assistant messages for a minimal transcript look.

```svelte
<script lang="ts">
	import { Message, MessageAvatar, MessageContent } from "$lib/registry/ui/message";
</script>

<Message from="user">
	<MessageAvatar src="/user-avatar.jpg" />
	<MessageContent variant="contained">This is a contained message with background</MessageContent>
</Message>

<Message from="assistant">
	<MessageAvatar src="/assistant-avatar.jpg" />
	<MessageContent variant="flat">This is a flat message with minimal styling</MessageContent>
</Message>
```

### In a Conversation

`Message` pairs with `Conversation` for auto-sticking scroll behavior as new turns stream in.

```svelte
<script lang="ts">
	import * as Conversation from "$lib/registry/ui/conversation";
	import { Message, MessageAvatar, MessageContent } from "$lib/registry/ui/message";

	type Turn = {
		id: string;
		from: "user" | "assistant";
		avatarUrl: string;
		name: string;
		content: string;
	};

	let messages: Turn[] = $state([]);
</script>

<Conversation.Root>
	<Conversation.Content>
		{#each messages as message (message.id)}
			<Message from={message.from}>
				<MessageAvatar src={message.avatarUrl} name={message.name} />
				<MessageContent>{message.content}</MessageContent>
			</Message>
		{/each}
	</Conversation.Content>
</Conversation.Root>
```

## API Reference

<ComponentAPI component="message" />

## Notes

- Uses CSS group selectors (`group-[.is-user]` / `group-[.is-assistant]`) so `MessageContent` and `MessageAvatar` style themselves based on the parent `Message`'s `from` prop.
- User messages align to the right; assistant messages align to the left.
- `MessageContent`'s `"contained"` variant uses `bg-primary` for the user and `bg-secondary` for the assistant. `"flat"` keeps the user bubble and removes the assistant background.
- `MessageAvatar` wraps the `Avatar` primitive — it renders a fallback with the first two characters of `name` (or `ME` if `name` is omitted) when the image fails to load.
- Combines cleanly with the [`Response`](/docs/components/response) component for streaming markdown content inside `MessageContent`.
