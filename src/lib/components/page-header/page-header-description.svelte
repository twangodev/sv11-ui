<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLParagraphElement> & { children?: Snippet } = $props();
</script>

<p
	class={cn("text-foreground max-w-3xl text-base text-balance sm:text-lg", className)}
	data-slot="page-header-description"
	{...restProps}
>
	{@render children?.()}
</p>
