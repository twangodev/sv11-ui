<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Streamdown, type StreamdownProps } from "svelte-streamdown";
	import Code from "svelte-streamdown/code";
	import Mermaid from "svelte-streamdown/mermaid";
	import Math from "svelte-streamdown/math";

	let {
		class: className,
		theme,
		...restProps
	}: StreamdownProps & {
		/**
		 * Extra classes merged onto the root `Streamdown` container. Top and
		 * bottom margins are stripped from the first and last children.
		 */
		class?: string;
	} = $props();
</script>

<!--
	Streamdown's root <div> only forwards `class` — it doesn't spread unknown
	attrs — so we can't pin data-slot on it directly. Wrap in a display:contents
	host so CSS/automation can target [data-slot="response"] without adding a
	layout box. (display:contents a11y bugs were fixed across modern browsers
	in 2022; role/labels on the Streamdown content are unaffected.)
-->
<div data-slot="response" class="contents">
	<Streamdown
		baseTheme="shadcn"
		theme={{
			paragraph: { base: "text-inherit" },
			ul: { base: "ml-0 [li_&]:pl-6" },
			ol: { base: "ml-0 [li_&]:pl-6" },
			li: { base: "[&>p]:inline" },
			...theme,
		}}
		components={{ code: Code, mermaid: Mermaid, math: Math }}
		class={cn(
			"size-full space-y-4 whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
			className
		)}
		{...restProps}
	/>
</div>
