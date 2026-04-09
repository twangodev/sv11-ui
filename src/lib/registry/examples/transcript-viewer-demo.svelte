<script lang="ts" module>
	import type { CharacterAlignment } from "$lib/registry/ui/transcript-viewer/index.js";

	// Hoisted to module scope so the prop reference is stable across renders
	// while alignment is loading — otherwise the root's segment-recompute
	// effect would re-run every time the demo component updates.
	const EMPTY_ALIGNMENT: CharacterAlignment = {
		characters: [],
		characterStartTimesSeconds: [],
		characterEndTimesSeconds: [],
	};
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import PlayIcon from "@lucide/svelte/icons/play";
	import PauseIcon from "@lucide/svelte/icons/pause";
	import {
		TranscriptViewer,
		TranscriptViewerAudio,
		TranscriptViewerWords,
		TranscriptViewerPlayPauseButton,
		TranscriptViewerScrubBar,
	} from "$lib/registry/ui/transcript-viewer/index.js";
	import { Skeleton } from "$lib/registry/ui/skeleton/index.js";

	const audioSrc = "https://svagent.ui.twango.dev/audio/transcript-viewer.wav";
	let alignment = $state<CharacterAlignment | undefined>(undefined);

	onMount(() => {
		fetch("https://svagent.ui.twango.dev/audio/transcript-viewer-alignment.json")
			.then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
			.then((data: CharacterAlignment) => {
				alignment = data;
			})
			.catch((err) => {
				console.error("Failed to load transcript alignment:", err);
			});
	});
</script>

<div class="flex w-full flex-col gap-4">
	<TranscriptViewer
		class="bg-card w-full rounded-xl border p-4"
		{audioSrc}
		audioType="audio/wav"
		alignment={alignment ?? EMPTY_ALIGNMENT}
	>
		<TranscriptViewerAudio class="sr-only" />
		{#if alignment}
			<TranscriptViewerWords />
			<div class="flex items-center gap-3">
				<TranscriptViewerScrubBar />
			</div>
		{:else}
			<div class="flex w-full flex-col gap-3">
				<Skeleton class="h-5 w-full" />
				<Skeleton class="mb-4 h-5 w-1/2" />
				<Skeleton class="h-2 w-full" />
				<div class="-mt-1 flex items-center justify-between">
					<Skeleton class="h-2 w-6" />
					<Skeleton class="h-2 w-6" />
				</div>
			</div>
		{/if}
		<TranscriptViewerPlayPauseButton
			class="w-full cursor-pointer"
			size="default"
			disabled={!alignment}
		>
			{#snippet children({ isPlaying })}
				{#if isPlaying}
					<PauseIcon class="size-4" /> Pause
				{:else}
					<PlayIcon class="size-4" /> Play
				{/if}
			{/snippet}
		</TranscriptViewerPlayPauseButton>
	</TranscriptViewer>
</div>
