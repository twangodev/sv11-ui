<script lang="ts">
	import Logo from "./logo.svelte";
	import { Button } from "$lib/registry/ui/button/index.js";
	import MainNav from "./main-nav.svelte";
	import Separator from "$lib/registry/ui/separator/separator.svelte";
	import GithubLink from "./github-link.svelte";
	import MobileNav from "./mobile-nav.svelte";
	import { mainNavItems } from "$lib/navigation.js";
	import ModeSwitcher from "./mode-switcher.svelte";
	import CommandMenu from "./command-menu.svelte";
	import ThemeSelector from "./theme-selector.svelte";

	let mobileNavRef: { closeMenu: () => void } | undefined;
</script>

<header class="bg-background sticky top-0 z-50 w-full">
	<div class="container-wrapper px-6">
		<div class="flex h-(--header-height) items-center gap-2 **:data-[slot=separator]:h-4!">
			<MobileNav bind:this={mobileNavRef} class="flex lg:hidden" />
			<Button href="/" variant="ghost" class="hidden h-8 px-2 lg:flex">
				<Logo class="!h-5 !w-auto" />
				<span class="sr-only">sv11-ui</span>
			</Button>
			<MainNav items={mainNavItems} class="hidden lg:flex" />
			<div class="ms-auto flex items-center gap-2 md:flex-1 md:justify-end">
				<div class="w-full flex-1 md:w-auto md:flex-none">
					<CommandMenu />
				</div>
				<Separator orientation="vertical" class="ms-2 hidden lg:block" />
				<GithubLink />
				<Separator orientation="vertical" />
				<ThemeSelector />
				<ModeSwitcher />
			</div>
		</div>
	</div>
</header>
