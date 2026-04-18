<script lang="ts" module>
	export const THEMES = [
		{ name: "default", label: "Default", swatch: "oklch(0.205 0 0)" },
		{ name: "blue", label: "Blue", swatch: "oklch(0.623 0.214 259.815)" },
		{ name: "green", label: "Green", swatch: "oklch(0.648 0.2 142.495)" },
		{ name: "amber", label: "Amber", swatch: "oklch(0.769 0.188 70.08)" },
		{ name: "rose", label: "Rose", swatch: "oklch(0.645 0.246 16.439)" },
		{ name: "purple", label: "Purple", swatch: "oklch(0.559 0.236 303.9)" },
		{ name: "orange", label: "Orange", swatch: "oklch(0.705 0.213 47.604)" },
		{ name: "teal", label: "Teal", swatch: "oklch(0.6 0.118 184.704)" },
	] as const;

	export type ThemeName = (typeof THEMES)[number]["name"];

	const STORAGE_KEY = "sv11-theme";
	const THEME_CLASSES = THEMES.filter((t) => t.name !== "default").map((t) => `theme-${t.name}`);

	export function applyTheme(name: ThemeName) {
		const html = document.documentElement;
		html.classList.remove(...THEME_CLASSES);
		if (name !== "default") html.classList.add(`theme-${name}`);
		try {
			localStorage.setItem(STORAGE_KEY, name);
		} catch {
			// ignore
		}
	}

	export function readStoredTheme(): ThemeName {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored && THEMES.some((t) => t.name === stored)) return stored as ThemeName;
		} catch {
			// ignore
		}
		return "default";
	}
</script>

<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import PaletteIcon from "@lucide/svelte/icons/palette";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Popover, PopoverContent, PopoverTrigger } from "$lib/registry/ui/popover/index.js";
	import { cn } from "$lib/utils.js";

	// The theme class is already on <html> from the pre-hydration inline
	// script in app.html — just mirror the stored value into reactive state
	// without re-applying. Writable so `choose()` can reassign it.
	let current = $derived.by(() => readStoredTheme());

	function choose(name: ThemeName) {
		current = name;
		applyTheme(name);
	}
</script>

<Popover>
	<PopoverTrigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="h-8 w-8">
				<PaletteIcon class="size-4" />
				<span class="sr-only">Select theme</span>
			</Button>
		{/snippet}
	</PopoverTrigger>
	<PopoverContent align="end" class="w-48 p-2">
		<div class="text-muted-foreground px-2 py-1.5 text-xs font-medium">Theme</div>
		<div class="flex flex-col">
			{#each THEMES as theme (theme.name)}
				<button
					type="button"
					onclick={() => choose(theme.name)}
					class={cn(
						"hover:bg-accent hover:text-accent-foreground flex items-center justify-between rounded-sm px-2 py-1.5 text-sm",
						current === theme.name && "bg-accent text-accent-foreground"
					)}
				>
					<span class="flex items-center gap-2">
						<span
							class="inline-block size-3 rounded-full border"
							style:background-color={theme.swatch}
						></span>
						{theme.label}
					</span>
					{#if current === theme.name}
						<CheckIcon class="size-4" />
					{/if}
				</button>
			{/each}
		</div>
	</PopoverContent>
</Popover>
