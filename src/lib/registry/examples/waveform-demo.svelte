<script lang="ts">
	import { Card, CardHeader, CardTitle, CardDescription } from "$lib/registry/ui/card/index.js";
	import { ScrollingWaveform } from "$lib/registry/ui/waveform/index.js";
</script>

<Card class="w-full p-6">
	<CardHeader class="p-0 pb-4">
		<CardTitle>Waveform</CardTitle>
		<CardDescription>Real-time audio visualization with smooth scrolling animation</CardDescription>
	</CardHeader>
	<ScrollingWaveform height={80} barWidth={3} barGap={2} speed={30} fadeEdges barColor="gray" />
</Card>
