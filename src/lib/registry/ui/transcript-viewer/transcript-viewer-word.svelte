<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import type { TranscriptWord } from "./utils.js";
	import type { TranscriptViewerWordStatus } from "./context.svelte.js";

	export type TranscriptViewerWordProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
		word: TranscriptWord;
		status: TranscriptViewerWordStatus;
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";

	let {
		word,
		status,
		class: className,
		children,
		...restProps
	}: TranscriptViewerWordProps = $props();
</script>

<span
	data-kind="word"
	data-status={status}
	class={cn(
		"rounded-sm px-0.5 transition-colors",
		status === "spoken" && "text-foreground",
		status === "unspoken" && "text-muted-foreground",
		status === "current" && "bg-primary text-primary-foreground",
		className
	)}
	{...restProps}
	data-slot="transcript-viewer-word"
>
	{#if children}{@render children()}{:else}{word.text}{/if}
</span>
