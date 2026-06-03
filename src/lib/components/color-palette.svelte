<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import { cn } from "$lib/utils.js";
	import {
		COLOR_GROUPS,
		pairedSurface,
		tokenUtility,
		type ColorToken,
	} from "./color-tokens.js";

	let copied = $state<string | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | null = null;

	async function copyToken(token: ColorToken) {
		// Copy the Tailwind class form (e.g. bg-primary / text-foreground) — what
		// you'd actually type.
		try {
			await navigator.clipboard.writeText(tokenUtility(token));
		} catch {
			return; // clipboard blocked (insecure context / denied) — leave UI untouched
		}
		copied = token.name;
		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = setTimeout(() => {
			copied = null;
			resetTimer = null;
		}, 1200);
	}
</script>

<div class="flex flex-col gap-8">
	{#each COLOR_GROUPS as group (group.title)}
		<section class="flex flex-col gap-3">
			<h3 class="text-sm font-medium">{group.title}</h3>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each group.tokens as token (token.name)}
					<button
						type="button"
						onclick={() => copyToken(token)}
						class="group bg-card hover:bg-accent/40 flex items-center gap-3 rounded-lg border p-2 text-left transition-colors"
						title={`Copy ${tokenUtility(token)}`}
					>
						<span
							class={cn(
								"size-9 shrink-0 rounded-md border",
								token.fg && "flex items-center justify-center"
							)}
							style={`background-color: var(--${token.fg ? pairedSurface(token.name) : token.name})`}
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
									{tokenUtility(token)}
								{/if}
							</span>
						</span>
					</button>
				{/each}
			</div>
		</section>
	{/each}
</div>
