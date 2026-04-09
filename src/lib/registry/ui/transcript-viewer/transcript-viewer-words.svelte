<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import type { GapSegment, TranscriptSegment, TranscriptWord } from "./utils.js";
	import type { TranscriptViewerWordStatus } from "./context.svelte.js";

	export type TranscriptViewerWordsProps = HTMLAttributes<HTMLDivElement> & {
		renderWord?: Snippet<[{ word: TranscriptWord; status: TranscriptViewerWordStatus }]>;
		renderGap?: Snippet<[{ segment: GapSegment; status: TranscriptViewerWordStatus }]>;
		wordClassNames?: string;
		gapClassNames?: string;
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import TranscriptViewerWord from "./transcript-viewer-word.svelte";
	import { useTranscriptViewer } from "./context.svelte.js";

	let {
		class: className,
		renderWord,
		renderGap,
		wordClassNames,
		gapClassNames,
		...restProps
	}: TranscriptViewerWordsProps = $props();

	const state = useTranscriptViewer();

	const nearEnd = $derived(state.duration ? state.currentTime >= state.duration - 0.01 : false);

	const segmentsWithStatus = $derived.by<
		Array<{ segment: TranscriptSegment; status: TranscriptViewerWordStatus }>
	>(() => {
		if (nearEnd) {
			return state.segments.map((segment) => ({ segment, status: "spoken" as const }));
		}

		const entries: Array<{ segment: TranscriptSegment; status: TranscriptViewerWordStatus }> = [];
		for (const segment of state.spokenSegments) {
			entries.push({ segment, status: "spoken" });
		}
		if (state.currentWord) {
			entries.push({ segment: state.currentWord, status: "current" });
		}
		for (const segment of state.unspokenSegments) {
			entries.push({ segment, status: "unspoken" });
		}
		return entries;
	});
</script>

<div
	class={cn("text-xl leading-relaxed", className)}
	{...restProps}
	data-slot="transcript-viewer-words"
>
	{#each segmentsWithStatus as entry (entry.segment.segmentIndex)}
		{#if entry.segment.kind === "gap"}
			<span data-kind="gap" data-status={entry.status} class={cn(gapClassNames)}>
				{#if renderGap}
					{@render renderGap({ segment: entry.segment, status: entry.status })}
				{:else}
					{entry.segment.text}
				{/if}
			</span>
		{:else if renderWord}
			<span data-kind="word" data-status={entry.status} class={cn(wordClassNames)}>
				{@render renderWord({ word: entry.segment, status: entry.status })}
			</span>
		{:else}
			<TranscriptViewerWord word={entry.segment} status={entry.status} class={wordClassNames} />
		{/if}
	{/each}
</div>
