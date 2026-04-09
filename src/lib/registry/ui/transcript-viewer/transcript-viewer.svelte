<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import type { AudioType, CharacterAlignment, SegmentComposer } from "./context.svelte.js";

	export type TranscriptViewerProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
		audioSrc: string;
		audioType?: AudioType;
		alignment: CharacterAlignment;
		segmentComposer?: SegmentComposer;
		hideAudioTags?: boolean;
		onPlay?: () => void;
		onPause?: () => void;
		onTimeUpdate?: (time: number) => void;
		onEnded?: () => void;
		onDurationChange?: (duration: number) => void;
		children?: Snippet;
		ref?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { setTranscriptViewer } from "./context.svelte.js";
	import { composeSegments, guessedDurationFrom } from "./utils.js";

	let {
		audioSrc,
		audioType = "audio/mpeg",
		alignment,
		segmentComposer,
		hideAudioTags = true,
		onPlay,
		onPause,
		onTimeUpdate,
		onEnded,
		onDurationChange,
		class: className,
		children,
		ref = $bindable(null),
		...restProps
	}: TranscriptViewerProps = $props();

	const state = setTranscriptViewer();

	// Sync audio src/type props → state so <TranscriptViewerAudio> can read them.
	$effect(() => {
		state.audioSrc = audioSrc;
		state.audioType = audioType;
	});

	// Recompute segments and reset playback whenever the alignment changes.
	$effect(() => {
		const composed = segmentComposer
			? segmentComposer(alignment)
			: composeSegments(alignment, { hideAudioTags });
		state.segments = composed.segments;
		state.words = composed.words;
		state.currentTime = 0;
		state.duration = guessedDurationFrom(alignment, composed.words);
		state.isPlaying = false;
		state.currentWordIndex = composed.words.length ? 0 : -1;
	});

	// Bind audio lifecycle: listeners + RAF sync loop. Re-runs whenever the
	// audio element (bound by <TranscriptViewerAudio>) appears or changes.
	$effect(() => {
		const audio = state.audio;
		if (!audio) return;

		let rafId: number | null = null;
		const stopRaf = () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		};
		const startRaf = () => {
			if (rafId !== null) return;
			const tick = () => {
				const node = state.audio;
				if (!node) {
					rafId = null;
					return;
				}
				if (!state.isScrubbing) {
					const t = node.currentTime;
					state.currentTime = t;
					state.handleTimeUpdate(t);
					// Opportunistically pick up duration when metadata arrives.
					if (Number.isFinite(node.duration) && node.duration > 0 && !state.duration) {
						state.duration = node.duration;
						onDurationChange?.(node.duration);
					}
				}
				rafId = requestAnimationFrame(tick);
			};
			rafId = requestAnimationFrame(tick);
		};

		const handlePlay = () => {
			state.isPlaying = true;
			startRaf();
			onPlay?.();
		};
		const handlePause = () => {
			state.isPlaying = false;
			state.currentTime = audio.currentTime;
			stopRaf();
			onPause?.();
		};
		const handleEnded = () => {
			state.isPlaying = false;
			state.currentTime = audio.currentTime;
			stopRaf();
			onEnded?.();
		};
		const handleTimeUpdateEvent = () => {
			state.currentTime = audio.currentTime;
			onTimeUpdate?.(audio.currentTime);
		};
		const handleSeeked = () => {
			state.currentTime = audio.currentTime;
			state.handleTimeUpdate(audio.currentTime);
		};
		const handleDuration = () => {
			state.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
			onDurationChange?.(audio.duration);
		};

		// Sync initial state
		state.isPlaying = !audio.paused;
		state.currentTime = audio.currentTime;
		if (Number.isFinite(audio.duration)) state.duration = audio.duration;
		if (!audio.paused) startRaf();

		audio.addEventListener("play", handlePlay);
		audio.addEventListener("pause", handlePause);
		audio.addEventListener("ended", handleEnded);
		audio.addEventListener("timeupdate", handleTimeUpdateEvent);
		audio.addEventListener("seeked", handleSeeked);
		audio.addEventListener("durationchange", handleDuration);
		audio.addEventListener("loadedmetadata", handleDuration);

		return () => {
			stopRaf();
			audio.removeEventListener("play", handlePlay);
			audio.removeEventListener("pause", handlePause);
			audio.removeEventListener("ended", handleEnded);
			audio.removeEventListener("timeupdate", handleTimeUpdateEvent);
			audio.removeEventListener("seeked", handleSeeked);
			audio.removeEventListener("durationchange", handleDuration);
			audio.removeEventListener("loadedmetadata", handleDuration);
		};
	});
</script>

<div
	bind:this={ref}
	class={cn("space-y-4 p-4", className)}
	{...restProps}
	data-slot="transcript-viewer-root"
>
	{@render children?.()}
</div>
