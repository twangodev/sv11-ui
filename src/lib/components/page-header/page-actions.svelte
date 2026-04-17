<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { children?: Snippet } = $props();
</script>

<div
	class={cn(
		"flex w-full items-center justify-center gap-2 pt-2 **:data-[slot=button]:shadow-none",
		className
	)}
	data-slot="page-actions"
	{...restProps}
>
	{@render children?.()}
</div>
