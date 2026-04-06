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
		from: "user" | "assistant";
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