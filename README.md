# svagent-ui

[svagent-ui](https://svagent.twango.dev) is a Svelte 5 port of [elevenlabs/ui](https://github.com/elevenlabs/ui), built on top of [shadcn-svelte](https://shadcn-svelte.com/) to help you build AI agent interfaces faster.

## Overview

svagent-ui brings the [ElevenLabs UI](https://ui.elevenlabs.io) component library to the Svelte ecosystem. Same components — orbs, waveforms, voice agents, audio players, conversation UIs, and more — rebuilt from the ground up for Svelte 5 and SvelteKit.

This time, it's provider-agnostic by design. You can bring your own backend (ElevenLabs, OpenAI, Deepgram, or custom).

The CLI makes it easy to add these components to your SvelteKit project.

## Installation

```bash
# Using shadcn-svelte CLI
npx shadcn-svelte@latest add https://svagent.twango.dev/r/<component-name>.json

# Install all components
npx shadcn-svelte@latest add https://svagent.twango.dev/r/all.json
```

## Prerequisites

Before using svagent-ui, ensure your SvelteKit project meets these requirements:

- **Node.js 18** or later
- **shadcn-svelte** initialized in your project
- **Tailwind CSS** configured
- **Svelte 5** with runes

## Usage

### Install Specific Components

```bash
# Install the message component
npx shadcn-svelte@latest add https://svagent.twango.dev/r/message.json

# Install the audio player
npx shadcn-svelte@latest add https://svagent.twango.dev/r/audio-player.json

# Install the orb
npx shadcn-svelte@latest add https://svagent.twango.dev/r/orb.json
```

### Install All Components

```bash
npx shadcn-svelte@latest add https://svagent.twango.dev/r/all.json
```

## Components

### UI Components

| Component           | Description                                         | Status  |
| ------------------- | --------------------------------------------------- | ------- |
| `message`           | Chat message bubble with avatar and variant styling | Done    |
| `response`          | Streaming markdown renderer for AI responses        | Done    |
| `shimmering-text`   | Text with shimmer/gradient animation                | Planned |
| `waveform`          | Static audio waveform visualization                 | Planned |
| `live-waveform`     | Real-time microphone waveform                       | Planned |
| `audio-player`      | Full-featured audio playback with scrubbing         | Planned |
| `bar-visualizer`    | Audio frequency band visualization                  | Planned |
| `voice-button`      | Voice input button with state feedback              | Planned |
| `conversation`      | Chat message container with auto-scroll             | Planned |
| `conversation-bar`  | Chat input bar with voice/text modes                | Planned |
| `speech-input`      | Real-time speech-to-text input                      | Planned |
| `transcript-viewer` | Synchronized transcript with audio playback         | Planned |
| `voice-picker`      | Voice selection dropdown with preview               | Planned |
| `scrub-bar`         | Audio timeline scrubber                             | Planned |
| `matrix`            | LED matrix display with animations                  | Planned |
| `mic-selector`      | Microphone device selector                          | Planned |
| `orb`               | 3D animated voice agent visualization               | Planned |

### Provider-Agnostic

Components that interact with AI services accept adapter interfaces — not SDK-specific types. Implement `ConversationAdapter`, `TranscriptionAdapter`, or `Voice` for your provider of choice.

```svelte
<script>
	import { ConversationBar } from "$lib/registry/ui/conversation-bar";
	import { createMyConversation } from "./my-adapter";

	const conversation = createMyConversation({ agentId: "xxx" });
</script>

<ConversationBar adapter={conversation} />
```
