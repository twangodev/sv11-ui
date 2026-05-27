<script lang="ts" module>
	type Token = { name: string; fg?: boolean };
	type Group = { title: string; tokens: Token[] };

	const GROUPS: Group[] = [
		{
			title: "Base",
			tokens: [
				{ name: "background" },
				{ name: "foreground", fg: true },
				{ name: "card" },
				{ name: "card-foreground", fg: true },
				{ name: "popover" },
				{ name: "popover-foreground", fg: true },
				{ name: "border" },
				{ name: "input" },
				{ name: "ring" },
			],
		},
		{
			title: "Semantic",
			tokens: [
				{ name: "primary" },
				{ name: "primary-foreground", fg: true },
				{ name: "secondary" },
				{ name: "secondary-foreground", fg: true },
				{ name: "muted" },
				{ name: "muted-foreground", fg: true },
				{ name: "accent" },
				{ name: "accent-foreground", fg: true },
				{ name: "destructive" },
			],
		},
		{
			title: "Charts",
			tokens: [
				{ name: "chart-1" },
				{ name: "chart-2" },
				{ name: "chart-3" },
				{ name: "chart-4" },
				{ name: "chart-5" },
			],
		},
		{
			title: "Sidebar",
			tokens: [
				{ name: "sidebar" },
				{ name: "sidebar-foreground", fg: true },
				{ name: "sidebar-primary" },
				{ name: "sidebar-primary-foreground", fg: true },
				{ name: "sidebar-accent" },
				{ name: "sidebar-accent-foreground", fg: true },
				{ name: "sidebar-border" },
				{ name: "sidebar-ring" },
			],
		},
	];
</script>

<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import { cn } from "$lib/utils.js";

	let copied = $state<string | null>(null);

	async function copyToken(name: string) {
		// Copy the Tailwind class form (e.g. bg-primary) — what you'd actually type.
		await navigator.clipboard.writeText(`bg-${name}`);
		copied = name;
		setTimeout(() => (copied = null), 1200);
	}
</script>

<div class="flex flex-col gap-8">
	{#each GROUPS as group (group.title)}
		<section class="flex flex-col gap-3">
			<h3 class="text-sm font-medium">{group.title}</h3>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each group.tokens as token (token.name)}
					<button
						type="button"
						onclick={() => copyToken(token.name)}
						class="group bg-card hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-2 text-left transition-colors"
						title={`Copy bg-${token.name}`}
					>
						<span
							class={cn(
								"size-9 shrink-0 rounded-md border",
								token.fg && "flex items-center justify-center"
							)}
							style={`background-color: var(--${token.name})`}
						>
							{#if token.fg}
								<span class="text-[10px]" style={`color: var(--${token.name})`}>Aa</span>
							{/if}
						</span>
						<span class="flex min-w-0 flex-col">
							<span class="truncate font-mono text-xs">--{token.name}</span>
							<span class="text-muted-foreground flex items-center gap-1 text-[11px]">
								{#if copied === token.name}
									<CheckIcon class="size-3" /> Copied
								{:else}
									<CopyIcon class="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
									bg-{token.name}
								{/if}
							</span>
						</span>
					</button>
				{/each}
			</div>
		</section>
	{/each}
</div>
