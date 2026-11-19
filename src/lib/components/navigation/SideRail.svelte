<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { CheckIcon, ChefHatIcon, ChevronsLeftIcon, ChevronsRightIcon } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { NAV_LINKS, childIsActive, linkIsActive } from './links';

	/**
	 * Desktop navigation: an icon rail from `md`, widening to show labels at
	 * `xl`. Hidden on mobile, where the bottom tab bar takes over.
	 *
	 * Submenus live inline under their section rather than in a flyout, so the
	 * whole hierarchy is visible at once. The rail still works while it is
	 * icon-only: child rows keep their icons and tooltips, and gain labels once
	 * the rail widens. The chevron at the bottom overrides the breakpoint and
	 * remembers the choice, so the rail can stay icon-only on a wide screen or
	 * show its labels below `xl`.
	 */
	type Props = { shoppingCount?: number };

	const { shoppingCount = 0 }: Props = $props();

	// Keep this key in step with the inline script in `app.html`, which applies
	// the preference before the first paint.
	const RAIL_STORAGE_KEY = 'cooklang-nav-rail';
	const xlQuery = '(min-width: 80rem)';

	type RailState = 'auto' | 'expanded' | 'collapsed';

	/** `auto` follows the breakpoint; the others are the person's choice. */
	let railState = $state<RailState>('auto');
	/** Whether `auto` currently means expanded, i.e. the viewport is at `xl`. */
	let wideViewport = $state(false);

	onMount(() => {
		try {
			const stored = localStorage.getItem(RAIL_STORAGE_KEY);
			if (stored === 'expanded' || stored === 'collapsed') railState = stored;
		} catch {
			// Storage is a convenience; the rail still works without it.
		}

		document.documentElement.dataset.navRail = railState;

		const media = window.matchMedia(xlQuery);
		wideViewport = media.matches;

		const onChange = (event: MediaQueryListEvent) => (wideViewport = event.matches);
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});

	const expanded = $derived(railState === 'expanded' || (railState === 'auto' && wideViewport));

	function toggleRail() {
		railState = expanded ? 'collapsed' : 'expanded';
		document.documentElement.dataset.navRail = railState;

		try {
			localStorage.setItem(RAIL_STORAGE_KEY, railState);
		} catch {
			// Same as above: the choice just will not survive a reload.
		}
	}

	const pathname = $derived(page.url.pathname);
</script>

<nav
	id="side-rail"
	class="border-border bg-surface rail-wide:w-(--spacing-sidebar) sticky top-0 hidden h-dvh w-(--spacing-rail) shrink-0 flex-col border-r py-4 md:flex"
	aria-label="Main"
>
	<a
		href="/"
		class="rail-wide:px-4 mb-6 flex items-center gap-3 px-5"
		aria-label="cooklang-web, go to recipes"
	>
		<ChefHatIcon class="text-accent size-7 shrink-0" />
		<span class="text-fg rail-wide:inline hidden text-lg font-semibold tracking-tight">Recipes</span
		>
	</a>

	<ul class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
		{#each NAV_LINKS as link (link.href)}
			{@const active = linkIsActive(link, pathname)}
			{@const childCurrent =
				link.children?.some((child) => childIsActive(pathname, child.href)) ?? false}
			<li>
				<a
					href={link.href}
					aria-current={active && !childCurrent ? 'page' : undefined}
					aria-label={link.label}
					title={link.label}
					class="rail-wide:justify-start rail-wide:px-3 flex items-center justify-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 {active
						? childCurrent
							? 'text-accent hover:bg-surface-muted'
							: 'bg-accent-soft text-accent-soft-fg'
						: 'text-fg-muted hover:bg-surface-muted hover:text-fg'}"
				>
					<link.icon class="size-5 shrink-0" />
					<span class="rail-wide:inline hidden">{link.label}</span>

					{#if link.href === '/shopping' && shoppingCount > 0}
						<Badge tone="accent" class="rail-wide:inline-flex ml-auto hidden">{shoppingCount}</Badge
						>
					{/if}
				</a>

				{#if link.children}
					<!--
						Icon-only rail: a centred stack of smaller icons, with the hairline
						running back up to the section icon so the group reads as its
						children. Once the rail widens they become an indented labelled list
						connected by the same line.
					-->
					<ul
						class="before:bg-border rail-wide:m-0 rail-wide:mt-1 rail-wide:ml-6 rail-wide:items-stretch rail-wide:gap-0 rail-wide:py-0 rail-wide:pl-3 rail-wide:before:left-0 rail-wide:before:translate-x-0 relative mt-0.5 mb-1 flex flex-col items-center gap-2 py-1 before:absolute before:-top-2 before:bottom-0 before:left-1/2 before:w-px before:-translate-x-1/2"
					>
						{#each link.children as child (child.href)}
							{@const current = childIsActive(pathname, child.href)}
							<li>
								<a
									href={child.href}
									aria-current={current ? 'page' : undefined}
									aria-label={child.ariaLabel ?? child.label}
									title={child.ariaLabel ?? child.label}
									class="rail-wide:justify-start rail-wide:px-2 rail-wide:py-1.5 relative flex items-center justify-center gap-2 rounded-md p-1.5 text-xs font-medium transition-colors duration-150 {current
										? 'bg-accent-soft text-accent-soft-fg'
										: 'bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg'}"
								>
									<child.icon class="size-4 shrink-0" />
									<span class="rail-wide:inline hidden min-w-0 flex-1 truncate">{child.label}</span>
									{#if current}
										<CheckIcon
											class="text-accent rail-wide:block hidden size-3.5 shrink-0"
											strokeWidth={3}
										/>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>

	<!-- The rail follows the breakpoint until this is used; from then on the
	     choice is explicit and remembered. -->
	<div class="border-border mt-2 border-t px-2 pt-2">
		<button
			type="button"
			onclick={toggleRail}
			aria-controls="side-rail"
			aria-expanded={expanded}
			aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
			title={expanded ? 'Collapse navigation' : 'Expand navigation'}
			class="text-fg-muted hover:bg-surface-muted hover:text-fg rail-wide:justify-start rail-wide:px-3 flex w-full items-center justify-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150"
		>
			<!-- Both icons are in the markup so the direction follows the same
			     CSS as the rail width, without waiting for hydration. -->
			<ChevronsLeftIcon class="rail-wide:block hidden size-5 shrink-0" aria-hidden="true" />
			<ChevronsRightIcon class="rail-wide:hidden size-5 shrink-0" aria-hidden="true" />
			<span class="rail-wide:inline hidden">Collapse</span>
		</button>
	</div>
</nav>
