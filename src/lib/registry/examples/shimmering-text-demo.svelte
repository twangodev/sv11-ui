<script lang="ts">
	import { ShimmeringText } from "$lib/registry/ui/shimmering-text/index.js";
	import { fly } from "svelte/transition";

	const phrases = [
		"Agent is thinking...",
		"Processing your request...",
		"Analyzing the data...",
		"Generating response...",
		"Almost there...",
	];

	let currentIndex = $state(0);

	$effect(() => {
		const interval = setInterval(() => {
			currentIndex = (currentIndex + 1) % phrases.length;
		}, 3000);
		return () => clearInterval(interval);
	});
</script>

<div class="bg-card w-full rounded-lg border p-6">
	<div class="mb-4">
		<h3 class="text-lg font-semibold">Text Shimmer Effect</h3>
		<p class="text-muted-foreground text-sm">Animated gradient text with automatic cycling</p>
	</div>

	<div class="space-y-4">
		<div class="bg-muted/10 relative flex items-center justify-center rounded-lg py-8">
			{#key currentIndex}
				<div
					class="absolute"
					in:fly={{ y: 10, duration: 300, delay: 300 }}
					out:fly={{ y: -10, duration: 300 }}
				>
					<ShimmeringText text={phrases[currentIndex]} />
				</div>
			{/key}
		</div>
	</div>
</div>
