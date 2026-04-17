<script lang="ts">
	import { fly } from "svelte/transition";
	import { BarVisualizer, type AgentState } from "$lib/registry/ui/bar-visualizer/index.js";
	import { Card, CardContent } from "$lib/registry/ui/card/index.js";
	import { ShimmeringText } from "$lib/registry/ui/shimmering-text/index.js";

	const states: AgentState[] = ["connecting", "initializing", "listening", "thinking", "speaking"];

	let currentIndex = $state(0);
	const barState = $derived(states[currentIndex]);

	$effect(() => {
		const interval = setInterval(() => {
			currentIndex = (currentIndex + 1) % states.length;
		}, 2500);
		return () => clearInterval(interval);
	});
</script>

<Card class="overflow-hidden p-0">
	<CardContent class="flex flex-col p-1">
		<div class="bg-background relative h-40 overflow-hidden rounded-t-lg">
			<BarVisualizer
				state={barState}
				demo={true}
				barCount={12}
				minHeight={20}
				maxHeight={80}
				class="h-full w-full bg-transparent p-3"
				centerAlign={false}
			/>
		</div>
		<div class="flex items-center justify-center py-3">
			{#key currentIndex}
				<div in:fly={{ y: 10, duration: 300 }} out:fly={{ y: -10, duration: 300 }}>
					<ShimmeringText text={barState} class="text-sm capitalize" />
				</div>
			{/key}
		</div>
	</CardContent>
</Card>
