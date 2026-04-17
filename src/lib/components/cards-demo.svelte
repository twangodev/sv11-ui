<script lang="ts">
	import OrbDemo from "$lib/registry/examples/orb-demo.svelte";
	import ConversationDemo from "$lib/registry/examples/conversation-demo.svelte";
	import AudioPlayerDemo from "$lib/registry/examples/audio-player-demo.svelte";
	import WaveformDemo from "$lib/registry/examples/waveform-demo.svelte";
	import BarVisualizerDemo from "$lib/registry/examples/bar-visualizer-demo.svelte";
	import VoicePickerDemo from "$lib/registry/examples/voice-picker-demo.svelte";
	import TranscriptViewerDemo from "$lib/registry/examples/transcript-viewer-demo.svelte";
	import LiveWaveformDemo from "$lib/registry/examples/live-waveform-demo.svelte";
	import MicSelectorDemo from "$lib/registry/examples/mic-selector-demo.svelte";
	import ScrubBarDemo from "$lib/registry/examples/scrub-bar-demo.svelte";
	import { Card, CardContent } from "$lib/registry/ui/card/index.js";
</script>

<!--
	Bento: fixed column flex stacks. Last tile in each column grows to fill,
	so all columns bottom-align. Columns collapse to fewer at smaller breakpoints.
-->
<div
	class="grid grid-cols-1 gap-4 **:data-[slot=card]:shadow-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
	data-slot="cards-demo"
>
	<!-- Column 1 -->
	<div class="flex flex-col gap-4">
		<AudioPlayerDemo />
		<div class="flex-1 [&>*]:h-full">
			<BarVisualizerDemo />
		</div>
	</div>

	<!-- Column 2 -->
	<div class="flex flex-col gap-4">
		<ConversationDemo />
		<div class="flex-1 [&>*]:h-full">
			<WaveformDemo />
		</div>
	</div>

	<!-- Column 3 -->
	<div class="flex flex-col gap-4">
		<TranscriptViewerDemo />
		<div class="flex-1 [&>*]:h-full">
			<OrbDemo small />
		</div>
	</div>

	<!-- Column 4 -->
	<div class="flex flex-col gap-4">
		<LiveWaveformDemo />
		<Card>
			<CardContent class="p-4">
				<VoicePickerDemo />
			</CardContent>
		</Card>
		<Card>
			<CardContent class="p-4">
				<ScrubBarDemo />
			</CardContent>
		</Card>
		<div class="flex-1 [&>*]:h-full">
			<MicSelectorDemo />
		</div>
	</div>
</div>
