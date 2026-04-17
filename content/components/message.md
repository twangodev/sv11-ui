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

### Basic Usage

Compose `Message` with `MessageAvatar` and `MessageContent`. The `from` prop drives alignment and which group-scoped styles apply to descendants.

```svelte
<script lang="ts">
	import * as Message from "$lib/registry/ui/message";
</script>

<Message.Root from="user">
	<Message.Avatar src="/user-avatar.jpg" name="John" />
	<Message.Content>Hello, how can I help you?</Message.Content>
</Message.Root>

<Message.Root from="assistant">
	<Message.Avatar src="/assistant-avatar.jpg" name="AI" />
	<Message.Content>I'm here to assist you with any questions!</Message.Content>
</Message.Root>
```

### Message Variants

`MessageContent` accepts a `variant` prop. The default `"contained"` gives each message a filled bubble; `"flat"` drops the background on assistant messages for a minimal transcript look.

```svelte
<script lang="ts">
	import * as Message from "$lib/registry/ui/message";
</script>

<Message.Root from="user">
	<Message.Avatar src="/user-avatar.jpg" />
	<Message.Content variant="contained">This is a contained message with background</Message.Content>
</Message.Root>

<Message.Root from="assistant">
	<Message.Avatar src="/assistant-avatar.jpg" />
	<Message.Content variant="flat">This is a flat message with minimal styling</Message.Content>
</Message.Root>
```

### In a Conversation

`Message` pairs with `Conversation` for auto-sticking scroll behavior as new turns stream in.

```svelte
<script lang="ts">
	import * as Conversation from "$lib/registry/ui/conversation";
	import * as Message from "$lib/registry/ui/message";

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
			<Message.Root from={message.from}>
				<Message.Avatar src={message.avatarUrl} name={message.name} />
				<Message.Content>{message.content}</Message.Content>
			</Message.Root>
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
