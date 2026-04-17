---
title: Troubleshooting
description: Common issues when installing and using svagent-ui components.
---

## Why are my components not styled?

svagent-ui assumes a Tailwind CSS 4 project with shadcn-svelte's base layer in place. Make sure the CSS entrypoint you import from your root layout (typically `src/app.css`) includes both Tailwind and the shadcn-svelte base styles:

```css
@import "tailwindcss";
@import "shadcn-svelte/tailwind.css";
```

Without the shadcn-svelte import, the CSS variables (`--background`, `--foreground`, `--primary`, etc.) that svagent components rely on will be undefined and components will render unstyled.

---

## I ran the install command but nothing was added to my project

svagent-ui distributes components through the `shadcn-svelte` CLI. Double-check that:

- Your current working directory is the root of your project (where `package.json` lives).
- `components.json` exists and is configured. If it isn't, the CLI will prompt you to initialize it the first time you run an `add` command.
- You're pinning `shadcn-svelte@latest` so the CLI understands the current registry schema:

```bash
npx shadcn-svelte@latest add https://svagent.ui.twango.dev/r/orb.json
```

---

## Theme switching doesn't work — my app stays in light mode

svagent-ui uses a `.dark` class on the `<html>` element, managed by [`mode-watcher`](https://github.com/svecosystem/mode-watcher). Two things need to be in place:

- Your root layout must render `<ModeWatcher />` so the class is applied and persisted:

```svelte
<script lang="ts">
	import { ModeWatcher } from "mode-watcher";
</script>

<ModeWatcher defaultMode="system" disableTransitions />
```

- Your CSS must declare a dark variant bound to that class. svagent's `app.css` uses:

```css
@custom-variant dark (&:is(.dark *));
```

If you are using a `data-theme` attribute or a different selector, component dark-mode styles will not activate.

---

## Component imports fail with "module not found"

SvelteKit uses the `$lib` alias, not `@/`. Registry components land under `src/lib/registry/ui/<name>/` and should be imported via `$lib/registry/ui/<name>`:

```svelte
<script lang="ts">
	import { Orb } from "$lib/registry/ui/orb";
</script>
```

The `$lib` alias is provided by SvelteKit out of the box and points at `src/lib`. If you've overridden it or added custom aliases, check the `kit.alias` block in your `svelte.config.js` and make sure `$lib` still resolves to `src/lib`.

---

## Still stuck?

If all else fails, feel free to open an issue on [GitHub](https://github.com/twangodev/svagent-ui/issues).
