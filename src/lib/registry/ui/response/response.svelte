<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Streamdown, type StreamdownProps } from "svelte-streamdown";
	import Code from "svelte-streamdown/code";
	import Mermaid from "svelte-streamdown/mermaid";
	import Math from "svelte-streamdown/math";

	let {
		class: className,
		...restProps
	}: StreamdownProps & {
		/**
		 * Extra classes merged onto the root `Streamdown` container. Top and
		 * bottom margins are stripped from the first and last children.
		 */
		class?: string;
	} = $props();
</script>

<Streamdown
	baseTheme="shadcn"
	components={{ code: Code, mermaid: Mermaid, math: Math }}
	class={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
	{...restProps}
/>
