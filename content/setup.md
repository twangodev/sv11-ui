---
title: Setup
description: Getting started with svagent-ui.
---

svagent-ui components are distributed through the `shadcn-svelte` CLI. Each component is published as a registry entry that the CLI fetches and writes into your project alongside any required dependencies.

```bash
npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/orb.json
```

## Prerequisites

Before installing svagent-ui, make sure your environment meets the following requirements:

- [Node.js](https://nodejs.org/) version 18 or later
- A [SvelteKit 2](https://svelte.dev/docs/kit) project
- [Svelte 5](https://svelte.dev/) with runes
- [Tailwind CSS 4](https://tailwindcss.com/) configured
- [shadcn-svelte](https://shadcn-svelte.com/) initialized in your project. If it isn't set up yet, running an install command will prompt you through initialization.

## Installing components

Install a single component by passing its registry URL to the `shadcn-svelte` CLI:

```bash
npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/<component-name>.json
```

For example, to add the message component:

```bash
npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/message.json
```

To install every svagent-ui component at once, use the `all` entry:

```bash
npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/all.json
```

The CLI downloads the component source, resolves any registry or npm dependencies, and writes the files into your project (typically under `src/lib/registry/ui/<name>/`). Once the command completes, import the component and use it in your code.
