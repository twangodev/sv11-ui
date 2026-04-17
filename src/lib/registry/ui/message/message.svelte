<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	let {
		class: className,
		from,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		/**
		 * Determines the message's alignment and which group-scoped styles
		 * (`is-user` / `is-assistant`) apply to `MessageContent` and
		 * `MessageAvatar` descendants.
		 */
		from: "user" | "assistant";
		/** Message body — typically a `MessageContent` and/or `MessageAvatar`. */
		children?: Snippet;
	} = $props();
</script>

<div
	data-slot="message"
	class={cn(
		"group flex w-full items-end justify-end gap-2 py-4",
		from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:global(.is-user) {
		--foreground: var(--primary-foreground);
		--card: var(--primary);
		--card-foreground: var(--primary-foreground);
		--muted: color-mix(in oklab, var(--primary) 88%, var(--primary-foreground));
		--muted-foreground: color-mix(in oklab, var(--primary-foreground) 70%, transparent);
		--border: color-mix(in oklab, var(--primary-foreground) 18%, transparent);
	}
</style>
