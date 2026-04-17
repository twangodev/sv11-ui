<script lang="ts">
	import SearchIcon from "@lucide/svelte/icons/search";
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { goto } from "$app/navigation";
	import {
		Command,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList,
	} from "$lib/registry/ui/command/index.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { blocks } from "$lib/blocks.js";
	import { adapters, components, gettingStarted } from "$content/index.js";
	import { cn } from "$lib/utils.js";

	let open = $state(false);

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			open = !open;
		}
	}

	function runCommand(href: string) {
		open = false;
		void goto(href);
	}

	$effect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	});

	const gettingStartedItems = gettingStarted.map((doc) => ({
		title: doc.title,
		href: doc.path === "index" ? "/docs" : `/docs/${doc.path}`,
	}));

	const adapterItems = adapters
		.filter((doc) => doc.path !== "adapters")
		.map((doc) => ({
			title: doc.title,
			href: `/docs/${doc.path}`,
		}));

	const componentItems = components
		.filter((doc) => doc.title !== "Components")
		.map((doc) => ({
			title: doc.title,
			href: `/docs/components/${doc.slug}`,
		}));

	const blockItems = blocks.map((b) => ({
		title: b.title,
		href: `/blocks#${b.name}`,
	}));
</script>

<Button
	variant="outline"
	class={cn(
		"bg-muted/50 text-muted-foreground relative h-8 w-full justify-start pr-12 pl-2.5 text-sm font-normal shadow-none sm:w-40 md:w-56 lg:w-64"
	)}
	onclick={() => (open = true)}
>
	<SearchIcon class="size-4" />
	<span class="hidden lg:inline-flex">Search docs…</span>
	<span class="inline-flex lg:hidden">Search…</span>
	<kbd
		class="bg-muted text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex"
	>
		<span class="text-xs">⌘</span>K
	</kbd>
</Button>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
		/>
		<DialogPrimitive.Content
			class="bg-popover data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border p-0 shadow-lg duration-200 sm:rounded-lg"
		>
			<DialogPrimitive.Title class="sr-only">Command Menu</DialogPrimitive.Title>
			<DialogPrimitive.Description class="sr-only">
				Search the site and jump to any page.
			</DialogPrimitive.Description>
			<Command
				class="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
			>
				<CommandInput placeholder="Type a command or search…" />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup>
						<div data-command-group-heading>Get Started</div>
						{#each gettingStartedItems as item (item.href)}
							<CommandItem value={item.title} onSelect={() => runCommand(item.href)}>
								{item.title}
							</CommandItem>
						{/each}
					</CommandGroup>
					{#if adapterItems.length}
						<CommandGroup>
							<div data-command-group-heading>Adapters</div>
							{#each adapterItems as item (item.href)}
								<CommandItem value={item.title} onSelect={() => runCommand(item.href)}>
									{item.title}
								</CommandItem>
							{/each}
						</CommandGroup>
					{/if}
					<CommandGroup>
						<div data-command-group-heading>Components</div>
						{#each componentItems as item (item.href)}
							<CommandItem value={item.title} onSelect={() => runCommand(item.href)}>
								{item.title}
							</CommandItem>
						{/each}
					</CommandGroup>
					<CommandGroup>
						<div data-command-group-heading>Blocks</div>
						{#each blockItems as item (item.href)}
							<CommandItem value={item.title} onSelect={() => runCommand(item.href)}>
								{item.title}
							</CommandItem>
						{/each}
					</CommandGroup>
				</CommandList>
			</Command>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
