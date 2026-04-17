<script lang="ts">
	import { AudioPlayer, exampleTracks } from "$lib/registry/ui/audio-player/index.js";
	import { Card } from "$lib/registry/ui/card/index.js";
	import { ScrollArea } from "$lib/registry/ui/scroll-area/index.js";
	import MusicPlayer01Player from "./music-player-01-player.svelte";
	import MusicPlayer01Song from "./music-player-01-song.svelte";
</script>

<AudioPlayer>
	<Card class="mx-auto w-full overflow-hidden p-0">
		<div class="flex flex-col lg:h-[180px] lg:flex-row">
			<div class="bg-muted/50 flex flex-col overflow-hidden lg:h-full lg:w-64">
				<ScrollArea class="h-48 w-full lg:h-full">
					<div class="space-y-1 p-3">
						{#each exampleTracks as song, index (song.id)}
							<MusicPlayer01Song {song} trackNumber={index + 1} />
						{/each}
					</div>
				</ScrollArea>
			</div>
			<MusicPlayer01Player />
		</div>
	</Card>
</AudioPlayer>
