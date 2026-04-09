<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";

	export type TranscriptViewerScrubBarProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
		showTimeLabels?: boolean;
		labelsClassName?: string;
		trackClassName?: string;
		progressClassName?: string;
		thumbClassName?: string;
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import {
		ScrubBar,
		ScrubBarTrack,
		ScrubBarProgress,
		ScrubBarThumb,
		ScrubBarTimeLabel,
	} from "$lib/registry/ui/scrub-bar/index.js";
	import { useTranscriptViewer } from "./context.svelte.js";

	let {
		class: className,
		showTimeLabels = true,
		labelsClassName,
		trackClassName,
		progressClassName,
		thumbClassName,
		...restProps
	}: TranscriptViewerScrubBarProps = $props();

	const state = useTranscriptViewer();
</script>

<ScrubBar
	duration={state.duration}
	value={state.currentTime}
	onScrub={state.seekToTime}
	onScrubStart={state.startScrubbing}
	onScrubEnd={state.endScrubbing}
	class={className}
	{...restProps}
	data-slot="transcript-viewer-scrub-bar"
>
	<div class="flex flex-1 flex-col gap-1">
		<ScrubBarTrack class={trackClassName}>
			<ScrubBarProgress class={progressClassName} />
			<ScrubBarThumb class={thumbClassName} />
		</ScrubBarTrack>
		{#if showTimeLabels}
			<div
				class={cn(
					"text-muted-foreground flex items-center justify-between text-xs",
					labelsClassName
				)}
			>
				<ScrubBarTimeLabel time={state.currentTime} />
				<ScrubBarTimeLabel time={state.duration - state.currentTime} />
			</div>
		{/if}
	</div>
</ScrubBar>
