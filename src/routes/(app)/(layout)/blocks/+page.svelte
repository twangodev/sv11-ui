<script lang="ts">
	import {
		PageActions,
		PageHeader,
		PageHeaderDescription,
		PageHeaderHeading,
	} from "$lib/components/page-header/index.js";
	import { blocks } from "$lib/blocks.js";
	import { Button } from "$lib/registry/ui/button/index.js";
</script>

<svelte:head>
	<title>Blocks | sv11-ui</title>
	<meta name="description" content="A gallery of full-page blocks built with sv11-ui components." />
</svelte:head>

<div class="flex flex-1 flex-col">
	<PageHeader>
		<PageHeaderHeading>Blocks</PageHeaderHeading>
		<PageHeaderDescription>
			Full-page compositions built with sv11-ui components. Use them as-is or as starting points.
		</PageHeaderDescription>
		<PageActions>
			<Button href="/docs/components" size="sm" variant="ghost">Browse Components</Button>
		</PageActions>
	</PageHeader>

	<div class="container-wrapper flex-1 pb-12">
		<div class="container space-y-12">
			{#each blocks as block (block.name)}
				<section id={block.name} class="scroll-mt-20 space-y-4">
					<div class="flex flex-col gap-1">
						<a
							href={`/view/${block.name}`}
							class="text-2xl font-semibold tracking-tight hover:underline"
						>
							{block.title}
						</a>
						<p class="text-muted-foreground text-sm">{block.description}</p>
					</div>
					<div
						class="bg-background relative aspect-[4/2.5] w-full overflow-hidden rounded-md border"
					>
						<iframe
							src={`/view/${block.name}`}
							class="absolute inset-0 size-full"
							title={block.title}
							loading="lazy"
						></iframe>
					</div>
				</section>
			{/each}
		</div>
	</div>
</div>
