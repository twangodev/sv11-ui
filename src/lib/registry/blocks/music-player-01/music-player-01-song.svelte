<script lang="ts">
	import PauseIcon from "@lucide/svelte/icons/pause";
	import PlayIcon from "@lucide/svelte/icons/play";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { useAudioPlayer } from "$lib/registry/ui/audio-player/index.js";
	import { cn } from "$lib/utils.js";

	type Track = { id: string; name: string; url: string };

	let { song, trackNumber }: { song: Track; trackNumber: number } = $props();

	const player = useAudioPlayer<Track>();
	const isActive = $derived(player.isItemActive(song.id));
	const isCurrentlyPlaying = $derived(isActive && player.isPlaying);
</script>

<div class="group/song relative">
	<Button
		variant={isActive ? "secondary" : "ghost"}
		size="sm"
		class={cn(
			"h-10 w-full justify-start px-3 font-normal sm:h-9 sm:px-2",
			isActive && "bg-secondary"
		)}
		onclick={() => {
			if (isCurrentlyPlaying) {
				void player.pause();
			} else {
				void player.play({ id: song.id, src: song.url, data: song });
			}
		}}
	>
		<div class="flex w-full items-center gap-3">
			<div class="flex w-5 shrink-0 items-center justify-center">
				{#if isCurrentlyPlaying}
					<PauseIcon class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
				{:else}
					<span class="text-muted-foreground/60 text-sm tabular-nums group-hover/song:invisible">
						{trackNumber}
					</span>
					<PlayIcon class="invisible absolute h-4 w-4 group-hover/song:visible sm:h-3.5 sm:w-3.5" />
				{/if}
			</div>
			<span class="truncate text-left text-sm">{song.name}</span>
		</div>
	</Button>
</div>
