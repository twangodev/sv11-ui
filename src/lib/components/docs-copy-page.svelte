<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import ChevronDownIcon from "@tabler/icons-svelte/icons/chevron-down";
	import CopyIcon from "@tabler/icons-svelte/icons/copy";
	import SiClaude from "@icons-pack/svelte-simple-icons/icons/SiClaude";
	import SiMarkdown from "@icons-pack/svelte-simple-icons/icons/SiMarkdown";
	import { Button, buttonVariants } from "$lib/registry/ui/button/index.js";
	import * as DropdownMenu from "$lib/registry/ui/dropdown-menu/index.js";
	import * as Popover from "$lib/registry/ui/popover/index.js";
	import { Separator } from "$lib/registry/ui/separator/index.js";
	import { UseClipboard } from "$lib/hooks/use-clipboard.svelte.js";
	import { cn } from "$lib/utils.js";
	import { page } from "$app/state";

	const pageUrl = $derived(page.url.origin + page.url.pathname);

	function getPromptUrl(baseURL: string) {
		return `${baseURL}?q=${encodeURIComponent(
			`I'm looking at this sv11-ui documentation: ${pageUrl}.
Help me understand how to use it. Be ready to explain concepts, give examples, or help debug based on it.`
		)}`;
	}

	const menuItems = {
		markdown: Markdown,
		chatgpt: ChatGPT,
		claude: Claude,
	};

	const clipboard = new UseClipboard();

	let customAnchor = $state<HTMLElement | null>(null);

	type PropsType = Record<string, unknown>;

	async function copyPage() {
		const res = await fetch(`${pageUrl}.md`);
		const text = await res.text();
		await clipboard.copy(text);
	}
</script>

{#snippet Trigger({ props }: { props: PropsType })}
	<Button
		{...props}
		variant="secondary"
		size="sm"
		class={cn("peer -ms-0.5 size-8 shadow-none md:size-7 md:text-[0.8rem]", props.class as string)}
	>
		<ChevronDownIcon class="rotate-180 sm:rotate-0" />
	</Button>
{/snippet}

{#snippet Markdown({ props }: { props: PropsType })}
	<a {...props} href={`${pageUrl}.md`} target="_blank" rel="noopener noreferrer">
		<SiMarkdown title="Markdown" />
		View as Markdown
	</a>
{/snippet}

{#snippet ChatGPT({ props }: { props: PropsType })}
	<a
		{...props}
		href={getPromptUrl("https://chatgpt.com")}
		target="_blank"
		rel="noopener noreferrer"
	>
		<!--
			Inline SVG (OpenAI logo). `@icons-pack/svelte-simple-icons@7.2.0` omits
			SiOpenai even though upstream `simple-icons` ships it; not worth a second
			dep for one icon.
		-->
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
			<path
				d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z"
				fill="currentColor"
			/>
		</svg>
		Open in ChatGPT
	</a>
{/snippet}

{#snippet Claude({ props }: { props: PropsType })}
	<a
		{...props}
		href={getPromptUrl("https://claude.ai/new")}
		target="_blank"
		rel="noopener noreferrer"
	>
		<SiClaude title="Claude" />
		Open in Claude
	</a>
{/snippet}

<Popover.Root>
	<div
		class="bg-secondary group/buttons relative flex rounded-lg *:data-[slot=button]:focus-visible:relative *:data-[slot=button]:focus-visible:z-10"
		data-llm-ignore
	>
		<div bind:this={customAnchor}></div>
		<Button
			variant="secondary"
			size="sm"
			class="h-8 shadow-none select-none md:h-7 md:text-[0.8rem]"
			onclick={copyPage}
		>
			{#if clipboard.copied}
				<CheckIcon />
			{:else}
				<CopyIcon />
			{/if}
			Copy Page
		</Button>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="hidden sm:flex">
				{#snippet child({ props })}
					{@render Trigger({ props })}
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="shadow-none">
				{#each Object.entries(menuItems) as [key, value] (key)}
					<DropdownMenu.Item>
						{#snippet child({ props })}
							{@render value({ props })}
						{/snippet}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		<Separator
			orientation="vertical"
			class="bg-foreground/10! absolute end-8 top-0 z-0 h-8! peer-focus-visible:opacity-0 sm:end-7 sm:h-7!"
		/>
		<Popover.Trigger class="flex sm:hidden">
			{#snippet child({ props })}
				{@render Trigger({ props })}
			{/snippet}
		</Popover.Trigger>
		<Popover.Content
			class="bg-background/70 dark:bg-background/60 w-52 origin-center! rounded-lg p-1 shadow-sm backdrop-blur-sm"
			align="start"
			{customAnchor}
		>
			{#each Object.entries(menuItems) as [key, value] (key)}
				{@render value({
					props: {
						class: cn(
							buttonVariants({
								variant: "ghost",
								size: "lg",
							}),
							"*:[svg]:text-muted-foreground w-full justify-start text-base font-normal"
						),
					},
				})}
			{/each}
		</Popover.Content>
	</div>
</Popover.Root>
