<script lang="ts" module>
	import type { Snippet } from "svelte";
	import type { ButtonProps } from "$lib/registry/ui/button/index.js";

	export type TranscriptViewerPlayPauseButtonProps = Omit<ButtonProps, "children"> & {
		children?: Snippet<[{ isPlaying: boolean }]>;
	};
</script>

<script lang="ts">
	import PlayIcon from "@lucide/svelte/icons/play";
	import PauseIcon from "@lucide/svelte/icons/pause";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { useTranscriptViewer } from "./context.svelte.js";

	let {
		class: className,
		children,
		onclick,
		variant = "outline",
		size = "icon",
		...restProps
	}: TranscriptViewerPlayPauseButtonProps = $props();

	const state = useTranscriptViewer();

	function handleClick(event: MouseEvent) {
		if (state.isPlaying) state.pause();
		else state.play();
		if (typeof onclick === "function") {
			// svelte's HTMLButtonAttributes types `onclick` as EventHandler<MouseEvent, HTMLButtonElement>
			(onclick as (e: MouseEvent) => void)(event);
		}
	}
</script>

<Button
	type="button"
	{variant}
	{size}
	aria-label={state.isPlaying ? "Pause audio" : "Play audio"}
	data-playing={state.isPlaying}
	class={cn("cursor-pointer", className)}
	onclick={handleClick}
	{...restProps}
	data-slot="transcript-viewer-play-pause-button"
>
	{#if children}
		{@render children({ isPlaying: state.isPlaying })}
	{:else if state.isPlaying}
		<PauseIcon class="size-5" />
	{:else}
		<PlayIcon class="size-5" />
	{/if}
</Button>
