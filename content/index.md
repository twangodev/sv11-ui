---
title: Introduction
description: A component registry for building AI agent interfaces with Svelte 5.
---

svagent-ui is a component registry for building AI agent interfaces — a Svelte 5 port of [elevenlabs/ui](https://github.com/elevenlabs/ui), built on top of [shadcn-svelte](https://shadcn-svelte.com/). It provides pre-built components for voice, chat, transcription, audio, and visualization.

Components are distributed via the `shadcn-svelte` CLI:

```bash
npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/<component>.json
```

For example, to install the [Orb](/docs/components/orb) component, you can run:

```bash
npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/orb.json
```

<ComponentPreview name="orb-demo" />

## Features

- **Provider-agnostic** — Wire up your own backend (ElevenLabs, OpenAI, Deepgram, custom, etc.) via `ConversationAdapter`, `TranscriptionAdapter`, and `Voice` interfaces.
- **Svelte 5** — Built with runes, snippets, and modern Svelte patterns.
- **Tailwind CSS 4** — Styled with tailwind-variants and tailwind-merge.
- **Accessible** — Built on bits-ui primitives.

Browse the full list of components at [/docs/components](/docs/components), or view the [source code](https://github.com/twangodev/svagent-ui) on GitHub.
