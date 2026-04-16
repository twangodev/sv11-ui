import { adapters, components, gettingStarted } from "$content/index.js";
import type { Component } from "svelte";

const GET_STARTED_ORDER = [
	"index",
	"setup",
	"usage",
	"providers",
	"theming",
	"dark-mode",
	"troubleshooting",
];

export const NEW_COMPONENTS = new Set<string>([]);

export type NavItem = {
	title: string;
	href?: string;
	disabled?: boolean;
	external?: boolean;
	label?: string;
	icon?: Component;
	indicator?: "new";
};

export type SidebarNavItem = NavItem & {
	items: SidebarNavItem[];
};

export type NavItemWithChildren = NavItem & {
	items: NavItemWithChildren[];
};

function generateGetStartedNav(): SidebarNavItem[] {
	const byPath = new Map(gettingStarted.map((doc) => [doc.path, doc]));
	const ordered: SidebarNavItem[] = [];

	for (const path of GET_STARTED_ORDER) {
		const doc = byPath.get(path);
		if (!doc) continue;
		byPath.delete(path);
		ordered.push({
			title: doc.title,
			href: path === "index" ? "/docs" : `/docs/${path}`,
			items: [],
		});
	}

	for (const doc of byPath.values()) {
		ordered.push({
			title: doc.title,
			href: `/docs/${doc.path}`,
			items: [],
		});
	}

	return ordered;
}

function generateAdaptersNav(): SidebarNavItem[] {
	const adaptersNavItems: SidebarNavItem[] = [];
	const index = adapters.find((doc) => doc.path === "adapters");
	if (index) {
		adaptersNavItems.push({
			title: index.title,
			href: "/docs/adapters",
			items: [],
		});
	}

	for (const doc of adapters) {
		if (doc.path === "adapters") continue;
		adaptersNavItems.push({
			title: doc.title,
			href: `/docs/${doc.path}`,
			items: [],
		});
	}

	return adaptersNavItems;
}

function generateComponentsNav(): SidebarNavItem[] {
	const componentsNavItems: SidebarNavItem[] = [];
	const index = components.find((doc) => doc.title === "Components");
	if (index) {
		componentsNavItems.push({
			title: index.title,
			href: `/docs/components`,
			items: [],
		});
	}

	for (const doc of components) {
		if (doc.title === "Components") continue;
		componentsNavItems.push({
			title: doc.title,
			indicator: NEW_COMPONENTS.has(doc.slug) ? "new" : undefined,
			href: `/docs/components/${doc.slug}`,
			items: [],
		});
	}

	return componentsNavItems;
}

const getStartedNav = generateGetStartedNav();
const adaptersNav = generateAdaptersNav();
const componentsNav = generateComponentsNav();

export const sidebarNavItems: SidebarNavItem[] = [
	{
		title: "Get Started",
		items: getStartedNav,
	},
	{
		title: "Adapters",
		items: adaptersNav.filter((item) => item.title !== "Adapters"),
	},
	{
		title: "Components",
		items: componentsNav.filter((item) => item.title !== "Components"),
	},
];

export const mainNavItems: NavItem[] = [
	{
		title: "Docs",
		href: "/docs",
	},
	{
		title: "Components",
		href: "/docs/components",
	},
];

export function getFullNavItems(): Array<SidebarNavItem & { index: number }> {
	return [...getStartedNav, ...adaptersNav, ...componentsNav].map((item, index) => ({
		...item,
		index,
	}));
}

const fullNavItems = getFullNavItems();

export function findNeighbors(pathName: string): {
	previous: SidebarNavItem | null;
	next: SidebarNavItem | null;
} {
	const path = pathName.split("?")[0].split("#")[0];
	const index = fullNavItems.findIndex((item) => item.href === path);

	let previous: SidebarNavItem | null = null;
	for (let i = index - 1; i >= 0; i--) {
		previous = fullNavItems[i];
		break;
	}

	let next: SidebarNavItem | null = null;
	for (let i = index + 1; i < fullNavItems.length; i++) {
		next = fullNavItems[i];
		break;
	}

	return { previous, next };
}
