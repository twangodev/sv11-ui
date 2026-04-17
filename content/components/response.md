---
title: Response
description: A streaming-friendly text response component for AI agent output.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/response
---

<ComponentPreview name="response-demo" />

## Installation

<Install component="response" />

## Usage

<Usage component="response" />

## Examples

### Basic Usage

Pass a string to the `content` prop. Any markdown is rendered to HTML on the fly.

```svelte
<script lang="ts">
	import { Response } from "$lib/registry/ui/response";
</script>

<Response content="This is a simple text response." />
```

### With Markdown

Full markdown is supported — headings, lists, tables, blockquotes, inline code, and fenced code blocks.

```svelte
<script lang="ts">
	import { Response } from "$lib/registry/ui/response";

	const content = `# Heading

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2
- List item 3

\`\`\`javascript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`
`;
</script>

<Response {content} />
```

### Streaming Response

Drive `content` from `$state` and append tokens as they arrive. `Response` forwards `parseIncompleteMarkdown` to Streamdown so partial syntax renders cleanly.

```svelte
<script lang="ts">
	import { Response } from "$lib/registry/ui/response";

	let content = $state("");

	function handleToken(token: string) {
		content += token;
	}
</script>

<Response {content} />
```

### With Message Component

Compose inside a `Message` to render streaming assistant output next to an avatar.

```svelte
<script lang="ts">
	import * as Message from "$lib/registry/ui/message";
	import { Response } from "$lib/registry/ui/response";

	let { streamingResponse }: { streamingResponse: string } = $props();
</script>

<Message.Root from="assistant">
	<Message.Avatar src="/ai-avatar.jpg" name="AI" />
	<Message.Content>
		<Response content={streamingResponse} />
	</Message.Content>
</Message.Root>
```

## API Reference

<ComponentAPI component="response" />

## Notes

- Wraps [`svelte-streamdown`](https://github.com/technologiestiftung/svelte-streamdown) with the `shadcn` base theme and preregistered `code`, `mermaid`, and `math` block renderers.
- All Streamdown props pass through — including `content`, `parseIncompleteMarkdown`, `animation`, `theme`, `shikiTheme`, `allowedLinkPrefixes`, and others. See the upstream Streamdown docs for the full surface.
- Top and bottom margins are stripped from the first and last children so the component drops cleanly into any container.
- Optimized for character-by-character streaming — safe to mutate `content` on every token.
- Pairs naturally with the `Message` component for chat-style assistant output.
