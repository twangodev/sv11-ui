# sv11-ui

SvelteKit 2 + Svelte 5 component registry for building AI agent interfaces. Includes voice/audio, chat, transcription, and visualization components. Provider-agnostic — users wire up their own backend (ElevenLabs, OpenAI, Deepgram, custom, etc.).

## Stack

- **Framework**: SvelteKit 2, Svelte 5, TypeScript
- **Styling**: Tailwind CSS 4, tailwind-variants (`tv()`), tailwind-merge
- **Components**: shadcn-svelte (bits-ui primitives)
- **Build**: Vite 8, pnpm, Node 24

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
  ui/voice-session/   # Shared contracts, session state, recording, and HTTP tasks
    adapters/         # Optional SDK bridges; AI SDK helper stays server-only
  ui/voice-picker/    # Provider-neutral Voice/VoiceLabels data types
  hooks/              # Svelte 5 rune-based hooks (.svelte.ts)
  blocks/<name>/      # Injectable application compositions
  examples/           # Documentation fixtures, including local sample backends
src/lib/utils.ts      # cn() utility
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
- Components own sessions created from their `adapter`; callers own externally supplied `session` lifetimes
- Keep public examples on consumer aliases (`$lib/components/ui`, `$lib/components/blocks`); repository source uses `$lib/registry`
- Document external/API guarantees and non-obvious ownership rules; keep behavior clear through small named functions
