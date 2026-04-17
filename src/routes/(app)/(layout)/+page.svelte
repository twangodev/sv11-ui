<script lang="ts">
	import { Button } from "$lib/registry/ui/button/index.js";
	import {
		PageHeader,
		PageHeaderHeading,
		PageHeaderDescription,
		PageActions,
	} from "$lib/components/page-header/index.js";
	import OrbDemo from "$lib/registry/examples/orb-demo.svelte";
	import CardsDemo from "$lib/components/cards-demo.svelte";
	import { siteConfig } from "$lib/config.js";
</script>

<div class="flex flex-1 flex-col">
	<div class="relative overflow-hidden">
		<div
			class="pointer-events-none absolute inset-0"
			style="background: radial-gradient(circle at center, transparent 0%, transparent 25%, color-mix(in oklab, var(--background) 50%, transparent) 50%, color-mix(in oklab, var(--background) 80%, transparent) 70%, color-mix(in oklab, var(--background) 95%, transparent) 85%, var(--background) 95%);"
		></div>
		<PageHeader class="relative z-10">
			<PageHeaderHeading class="max-w-4xl">svagent-ui</PageHeaderHeading>
			<PageHeaderDescription>{siteConfig.description}</PageHeaderDescription>
			<PageActions>
				<Button href="/docs" size="sm">Get Started</Button>
				<Button href="/docs/components" size="sm" variant="ghost">View Components</Button>
			</PageActions>
		</PageHeader>
	</div>
	<div class="container-wrapper flex-1 pb-6">
		<div class="container overflow-hidden">
			<section class="pt-8 md:hidden">
				<OrbDemo />
			</section>
			<section class="hidden pt-8 md:block">
				<CardsDemo />
			</section>
		</div>
	</div>
</div>
