<script lang="ts">
	import { AudioPlayer } from "$lib/registry/ui/audio-player/index.js";
	import SpeakerInner from "./speaker-inner.svelte";

	let { class: className }: { class?: string } = $props();
</script>

<AudioPlayer>
	<SpeakerInner class={className} />
</AudioPlayer>
