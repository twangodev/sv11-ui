# svagent-ui

SvelteKit 2 + Svelte 5 component registry for building AI agent interfaces. Includes voice/audio, chat, transcription, and visualization components. Provider-agnostic — users wire up their own backend (ElevenLabs, OpenAI, Deepgram, custom, etc.).

## Stack

- **Framework**: SvelteKit 2, Svelte 5, TypeScript
- **Styling**: Tailwind CSS 4, tailwind-variants (`tv()`), tailwind-merge
- **Components**: shadcn-svelte (bits-ui primitives)
- **Build**: Vite 6, pnpm

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm check          # svelte-check + tsc
pnpm lint           # prettier + eslint
pnpm build:registry # build component registry
```

## Project Layout

```
src/lib/registry/
  ui/<name>/          # UI components (button/, card/, message/, etc.)
  hooks/              # Svelte 5 rune-based hooks (.svelte.ts)
  blocks/<name>/      # Full-page example compositions
  lib/
    types.ts          # Provider-agnostic interfaces (Voice, ConversationAdapter, TranscriptionAdapter)
    utils.ts          # cn() utility
src/routes/           # SvelteKit pages
registry.json         # Component registry metadata
```

## Component Conventions

- Props via `$props()` destructuring, rename `class` → `className`
- Variants via `tv()` from tailwind-variants (not CVA)
- Children via `Snippet` + `{@render children?.()}`
- Refs via `$bindable()` + `bind:this`
- State via `$state()`, derived via `$derived()`, effects via `$effect()`
- Context via `setContext()`/`getContext()` (replaces React Context)
- Every component gets `data-slot="<name>"` attribute
- Class merging via `cn()` from `$lib/utils`
- Barrel exports in `index.ts` with both named and aliased exports (e.g., `Card as Root`)
- Accessible primitives from bits-ui, not raw HTML elements
