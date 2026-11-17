import type { Component } from 'svelte';
import {
	BookOpenIcon,
	CalendarDaysIcon,
	CarrotIcon,
	CircleHelpIcon,
	CookingPotIcon,
	RefrigeratorIcon,
	ShoppingCartIcon,
	SignpostIcon
} from '@lucide/svelte';

export type NavChild = {
	label: string;
	href: string;
	icon: Component<{ class?: string }>;
	/** Full name for screen readers where the visible label relies on context. */
	ariaLabel?: string;
};

export type NavLink = {
	label: string;
	href: string;
	icon: Component<{ class?: string }>;
	/**
	 * Extra path prefixes that belong to this section. `href` is always
	 * included, so this is only needed where a section spans several roots.
	 */
	active?: readonly string[];
	/**
	 * Submenu entries. They render inline under the section on the desktop
	 * rail; on the mobile bar tapping the parent opens the same list, so the
	 * first child should be the parent's own page.
	 */
	children?: readonly NavChild[];
};

/**
 * Shared by the mobile tab bar and the desktop rail, so they cannot drift.
 *
 * "Ingredients" is the section name: the ingredient browser is the parent
 * page, while editing the aisle grammar and sorting what has no aisle yet are
 * destinations of their own rather than tabs inside it.
 */
export const NAV_LINKS: readonly NavLink[] = [
	{
		label: 'Recipes',
		href: '/',
		icon: CookingPotIcon,
		active: ['/recipe', '/recipes', '/meal-plan'],
		children: [
			{ label: 'Browse', href: '/', icon: BookOpenIcon, ariaLabel: 'Browse recipes' },
			{ label: 'Meal plan', href: '/meal-plan', icon: CalendarDaysIcon }
		]
	},
	{ label: 'Shopping', href: '/shopping', icon: ShoppingCartIcon },
	{
		label: 'Ingredients',
		href: '/ingredients',
		icon: CarrotIcon,
		active: ['/ingredients'],
		children: [
			{
				label: 'Browse',
				href: '/ingredients',
				icon: BookOpenIcon,
				ariaLabel: 'Browse ingredients'
			},
			{ label: 'Aisles', href: '/ingredients/aisles', icon: SignpostIcon },
			{ label: 'Unassigned', href: '/ingredients/unassigned', icon: CircleHelpIcon }
		]
	},
	{ label: 'Pantry', href: '/pantry', icon: RefrigeratorIcon }
];

/** Exact match for a child page, ignoring the query string. */
export function childIsActive(pathname: string, href: string): boolean {
	return pathname === href;
}

/** A section is current when its own page or any of its routes is open. */
export function linkIsActive(link: NavLink, pathname: string): boolean {
	const prefixes = link.active ?? [link.href];

	return (
		prefixes.some((prefix) => matchesPath(pathname, prefix)) ||
		(link.children ?? []).some((child) => matchesPath(pathname, child.href))
	);
}

function matchesPath(pathname: string, href: string): boolean {
	// "/" would otherwise prefix every route.
	return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
