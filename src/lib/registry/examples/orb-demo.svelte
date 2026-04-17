<script lang="ts">
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Orb, type OrbAgentState } from "$lib/registry/ui/orb/index.js";

	let { small = false }: { small?: boolean } = $props();

	const ALL_ORBS: Array<[string, string]> = [
		["#CADCFC", "#A0B9D1"],
		["#F6E7D8", "#E0CFC2"],
		["#E5E7EB", "#9CA3AF"],
	];

	const orbs = $derived(small ? [ALL_ORBS[0]] : ALL_ORBS);

	let agent = $state<OrbAgentState>(null);
</script>

<div class="bg-card w-full rounded-lg border p-6">
	<div class="mb-4">
		<h3 class="text-lg font-semibold">Agent Orbs</h3>
		<p class="text-muted-foreground text-sm">Interactive orb visualization with agent states</p>
	</div>

	<div class="space-y-4">
		<div class="flex justify-center gap-8">
			{#each orbs as colors, index (index)}
				<div class={`relative ${index === 1 ? "block md:block" : "hidden md:block"}`}>
					<div
						class="bg-muted relative h-32 w-32 rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
					>
						<div
							class="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]"
						>
							<Orb {colors} seed={(index + 1) * 1000} agentState={agent} />
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="flex flex-wrap justify-center gap-2">
			<Button size="sm" variant="outline" onclick={() => (agent = null)} disabled={agent === null}>
				Idle
			</Button>
			<Button
				size="sm"
				variant="outline"
				onclick={() => (agent = "listening")}
				disabled={agent === "listening"}
			>
				Listening
			</Button>
			<Button
				size="sm"
				variant="outline"
				onclick={() => (agent = "talking")}
				disabled={agent === "talking"}
			>
				Talking
			</Button>
		</div>
	</div>
</div>
