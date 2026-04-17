<script lang="ts">
	import {
		AudioPlayerButton,
		AudioPlayerDuration,
		AudioPlayerProgress,
		AudioPlayerTime,
		exampleTracks,
		useAudioPlayer,
	} from "$lib/registry/ui/audio-player/index.js";
	import { Card } from "$lib/registry/ui/card/index.js";

	const player = useAudioPlayer<{ name: string }>();
	const track = exampleTracks[9];
</script>

<Card class="w-full overflow-hidden p-4">
	<div class="space-y-4">
		<div>
			<h3 class="text-base font-semibold">
				{player.activeItem?.data?.name || track.name}
			</h3>
		</div>
		<div class="flex items-center gap-3">
			<AudioPlayerButton
				variant="outline"
				size="default"
				class="h-10 w-10 shrink-0"
				item={{ id: track.id, src: track.url, data: track }}
			/>
			<div class="flex flex-1 items-center gap-2">
				<AudioPlayerTime class="text-xs tabular-nums" />
				<AudioPlayerProgress class="flex-1" />
				<AudioPlayerDuration class="text-xs tabular-nums" />
			</div>
		</div>
	</div>
</Card>
