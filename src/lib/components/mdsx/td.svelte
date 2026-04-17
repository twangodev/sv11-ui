<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLTdAttributes } from "svelte/elements";

	let { class: className, children, ...restProps }: HTMLTdAttributes = $props();
</script>

<td
	class={cn(
		"px-4 py-2 text-start align-top break-words [&[align=center]]:text-center [&[align=right]]:text-end [&_code]:break-all",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</td>
