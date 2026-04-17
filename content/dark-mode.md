---
title: Dark Mode
description: Add light and dark themes to a svagent-ui project with mode-watcher.
---

svagent-ui relies on [`mode-watcher`](https://github.com/svecosystem/mode-watcher) to toggle a `.dark` class on the `<html>` element and persist the user's choice across sessions. Every component's dark styles are scoped to that class, so wiring mode-watcher into your root layout is all that's needed for themes to work.

## Install mode-watcher

```bash
npm install mode-watcher
```

## Add the watcher

Render `<ModeWatcher />` once near the top of your root layout so the class is applied and persisted before the rest of the tree renders:

```svelte
<script lang="ts">
	import "../app.css";
	import { ModeWatcher } from "mode-watcher";

	let { children } = $props();
</script>

<ModeWatcher />
{@render children()}
```

The svagent-ui docs site renders it with `defaultMode="system"` and `disableTransitions`, which honors the user's OS preference on first load and suppresses the color-flash animation when the class flips:

```svelte
<ModeWatcher defaultMode="system" disableTransitions />
```

See the [mode-watcher documentation](https://mode-watcher.svecosystem.com) for the full list of props.

## CSS setup

svagent-ui's Tailwind entrypoint declares a custom variant that activates whenever an element has an ancestor with the `.dark` class:

```css
@custom-variant dark (&:is(.dark *));
```

The `:root` block defines the light-mode tokens, and a `.dark { ... }` block overrides them when the class is present. For example:

```css
:root {
	--primary: oklch(0.205 0 0);
}

.dark {
	--primary: oklch(0.922 0 0);
}
```

Because every token is swapped in one place, you generally won't need to write your own `dark:` utilities — the existing components already pick up the right values automatically. If you are using a `data-theme` attribute or a different selector, svagent's dark styles will not activate.

## Building a toggle

`mode-watcher` exposes a `toggleMode` helper that flips between light and dark. Paired with a button from the registry, a minimal toggle looks like this:

```svelte
<script lang="ts">
	import { toggleMode } from "mode-watcher";
	import { Button } from "$lib/registry/ui/button";
</script>

<Button variant="ghost" size="icon" onclick={toggleMode}>
	<span class="sr-only">Toggle theme</span>
</Button>
```

This is the same pattern the svagent-ui docs site uses in its header mode switcher.

## Reading the current mode

When a component needs to branch on the active theme — for example to swap a shader uniform or an image source — import the reactive `mode` store and read `mode.current`:

```svelte
<script lang="ts">
	import { mode } from "mode-watcher";

	let isDark = $derived(mode.current === "dark");
</script>
```

`mode.current` is reactive, so anything derived from it updates automatically when the user toggles themes.
