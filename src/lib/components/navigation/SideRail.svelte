<script lang="ts">
	import { page } from '$app/state';
	import { CheckIcon, ChefHatIcon } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { NAV_LINKS, childIsActive, linkIsActive } from './links';

	/**
	 * Desktop navigation: an icon rail from `md`, widening to show labels at
	 * `xl`. Hidden on mobile, where the bottom tab bar takes over.
	 *
	 * Submenus live inline under their section rather than in a flyout, so the
	 * whole hierarchy is visible at once. The rail still works while it is
	 * icon-only: child rows keep their icons and tooltips, and gain labels once
	 * the rail widens.
	 */
	type Props = { shoppingCount?: number };

	const { shoppingCount = 0 }: Props = $props();

	const pathname = $derived(page.url.pathname);
</script>

<nav
	class="border-border bg-surface sticky top-0 hidden h-dvh w-(--spacing-rail) shrink-0 flex-col border-r py-4 md:flex xl:w-(--spacing-sidebar)"
	aria-label="Main"
>
	<a
		href="/"
		class="mb-6 flex items-center gap-3 px-5 xl:px-4"
		aria-label="cooklang-web, go to recipes"
	>
		<ChefHatIcon class="text-accent size-7 shrink-0" />
		<span class="text-fg hidden text-lg font-semibold tracking-tight xl:inline">Recipes</span>
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
					class="flex items-center justify-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 xl:justify-start xl:px-3 {active
						? childCurrent
							? 'text-accent hover:bg-surface-muted'
							: 'bg-accent-soft text-accent-soft-fg'
						: 'text-fg-muted hover:bg-surface-muted hover:text-fg'}"
				>
					<link.icon class="size-5 shrink-0" />
					<span class="hidden xl:inline">{link.label}</span>

					{#if link.href === '/shopping' && shoppingCount > 0}
						<Badge tone="accent" class="ml-auto hidden xl:inline-flex">{shoppingCount}</Badge>
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
						class="before:bg-border relative mt-0.5 mb-1 flex flex-col items-center gap-2 py-1 before:absolute before:-top-2 before:bottom-0 before:left-1/2 before:w-px before:-translate-x-1/2 xl:m-0 xl:mt-1 xl:ml-6 xl:items-stretch xl:gap-0 xl:py-0 xl:pl-3 xl:before:left-0 xl:before:translate-x-0"
					>
						{#each link.children as child (child.href)}
							{@const current = childIsActive(pathname, child.href)}
							<li>
								<a
									href={child.href}
									aria-current={current ? 'page' : undefined}
									aria-label={child.ariaLabel ?? child.label}
									title={child.ariaLabel ?? child.label}
									class="relative flex items-center justify-center gap-2 rounded-md p-1.5 text-xs font-medium transition-colors duration-150 xl:justify-start xl:px-2 xl:py-1.5 {current
										? 'bg-accent-soft text-accent-soft-fg'
										: 'bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg'}"
								>
									<child.icon class="size-4 shrink-0" />
									<span class="hidden min-w-0 flex-1 truncate xl:inline">{child.label}</span>
									{#if current}
										<CheckIcon
											class="text-accent hidden size-3.5 shrink-0 xl:block"
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
</nav>
