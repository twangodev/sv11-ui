<script lang="ts" module>
	import type { HTMLAudioAttributes } from "svelte/elements";

	export type TranscriptViewerAudioProps = Omit<HTMLAudioAttributes, "src" | "children"> & {
		ref?: HTMLAudioElement | null;
	};
</script>

<script lang="ts">
	import { useTranscriptViewer } from "./context.svelte.js";

	let {
		class: className,
		ref = $bindable(null),
		...restProps
	}: TranscriptViewerAudioProps = $props();

	const state = useTranscriptViewer();

	// Keep both the local `ref` and the shared state.audio pointing at the
	// same element so external consumers can still `bind:ref` if desired.
	$effect(() => {
		state.audio = ref;
	});
</script>

<audio
	bind:this={ref}
	controls={false}
	preload="metadata"
	src={state.audioSrc}
	class={className}
	{...restProps}
	data-slot="transcript-viewer-audio"
>
	<source src={state.audioSrc} type={state.audioType} />
</audio>
