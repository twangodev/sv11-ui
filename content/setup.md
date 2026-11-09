---
title: Setup
description: Getting started with sv11-ui.
---

sv11-ui components are distributed through the `shadcn-svelte` CLI. Each component is published as a registry entry that the CLI fetches and writes into your project alongside any required dependencies.

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/orb.json
```

## Prerequisites

Before installing sv11-ui, make sure your environment meets the following requirements:

- [Node.js](https://nodejs.org/) 24 for the supported sv11-ui development/build baseline
- A [SvelteKit 2](https://svelte.dev/docs/kit) project
- [Svelte 5](https://svelte.dev/) with runes
- [Tailwind CSS 4](https://tailwindcss.com/) configured
- [shadcn-svelte](https://shadcn-svelte.com/) initialized in your project. If it isn't set up yet, running an install command will prompt you through initialization.

## Installing components

Install a single component by passing its registry URL to the `shadcn-svelte` CLI:

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/<component-name>.json
```

For example, to add the message component:

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/message.json
```

To install every sv11-ui component at once, use the `all` entry:

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/all.json
```

The CLI downloads the component source, resolves registry and npm dependencies, and writes files using the aliases in your `components.json`. The examples assume the standard UI alias, `$lib/components/ui`, so a component normally lands under `src/lib/components/ui/<name>/`. Adjust imports if your project uses another alias.

Optional adapters are separate registry entries. The AI SDK 7 integration requires Node 22 or newer on its backend; use the supported Node 24 baseline when developing this repository.
