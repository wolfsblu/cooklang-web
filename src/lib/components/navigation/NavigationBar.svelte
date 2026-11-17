<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { CheckIcon } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { NAV_LINKS, childIsActive, linkIsActive } from './links';

	/**
	 * Bottom tab bar for phones. A tab with children opens a small flyout
	 * above the bar instead of navigating on the first tap; the first item in
	 * that flyout is the parent page itself, so nothing becomes unreachable.
	 *
	 * The trigger is still a real link: without JavaScript it goes straight to
	 * the section's landing page, which is the best possible fallback.
	 */
	type Props = { shoppingCount?: number };

	const { shoppingCount = 0 }: Props = $props();

	let navEl = $state<HTMLElement | null>(null);
	let openHref = $state<string | null>(null);
	let triggers = $state<Record<string, HTMLAnchorElement | null>>({});

	const pathname = $derived(page.url.pathname);

	// A route change means the submenu has done its job.
	afterNavigate(() => {
		openHref = null;
	});

	function toggle(href: string) {
		openHref = openHref === href ? null : href;
	}

	function onLinkClick(event: MouseEvent, href: string) {
		// Leave modified and non-primary clicks alone so links can still be
		// opened in a new tab like any other link.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		toggle(href);
	}

	function closeOnOutside(event: PointerEvent) {
		if (!openHref || !navEl) return;
		if (event.target instanceof Node && navEl.contains(event.target)) return;
		openHref = null;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !openHref) return;
		const href = openHref;
		openHref = null;
		triggers[href]?.focus();
	}

	/** Keep the flyout inside the viewport when it belongs to an edge tab. */
	function align(index: number): string {
		if (index === 0) return 'left-0';
		if (index === NAV_LINKS.length - 1) return 'right-0';
		return 'left-1/2 -translate-x-1/2';
	}

	/** The caret points at the tab, even when the card is shifted sideways. */
	function caretStyle(index: number): string {
		const tabCenter = ((index + 0.5) / NAV_LINKS.length) * 100;
		if (index === 0) return `left: ${tabCenter}vw`;
		if (index === NAV_LINKS.length - 1) return `right: ${100 - tabCenter}vw`;
		return 'left: 50%';
	}
</script>

<svelte:window onpointerdown={closeOnOutside} onkeydown={onKeydown} />

<!--
	Sticky, not just the last row of the layout grid: without this the tab bar
	sits at the end of the content and scrolls out of reach on any page taller
	than the viewport, which is every page on a phone.
-->
<nav
	bind:this={navEl}
	class="border-border bg-surface/90 sticky bottom-0 z-30 border-t backdrop-blur-md md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom)"
	aria-label="Main"
>
	<ul class="flex">
		{#each NAV_LINKS as link, index (link.href)}
			{@const active = linkIsActive(link, pathname)}
			{@const childCurrent =
				link.children?.some((child) => childIsActive(pathname, child.href)) ?? false}
			{@const expanded = openHref === link.href}
			<li class="relative flex-1">
				{#if link.children}
					<a
						href={link.href}
						bind:this={triggers[link.href]}
						aria-current={active && !childCurrent ? 'page' : undefined}
						aria-expanded={expanded}
						aria-controls={expanded ? `mobile-nav-submenu-${index}` : undefined}
						onclick={(event) => onLinkClick(event, link.href)}
						class="relative flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors duration-150 {active
							? 'text-accent'
							: 'text-fg-muted hover:text-fg'}"
					>
						<span class="relative">
							<link.icon class="size-5" />
							{#if link.href === '/shopping' && shoppingCount > 0}
								<Badge
									tone="accent"
									class="absolute -top-1.5 -right-2.5 min-w-4 justify-center px-1 py-0 text-[0.625rem]"
								>
									{shoppingCount}
								</Badge>
							{/if}
						</span>
						{link.label}
					</a>

					{#if expanded}
						<div
							id="mobile-nav-submenu-{index}"
							class="bg-surface border-border shadow-pop absolute bottom-full z-40 mb-2 w-44 rounded-lg border p-1 {align(
								index
							)}"
						>
							<ul class="flex flex-col" aria-label="{link.label} menu">
								{#each link.children as child (child.href)}
									{@const current = childIsActive(pathname, child.href)}
									<li>
										<a
											href={child.href}
											aria-current={current ? 'page' : undefined}
											aria-label={child.ariaLabel ?? child.label}
											class="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150 {current
												? 'bg-accent-soft text-accent-soft-fg'
												: 'text-fg-muted hover:bg-surface-muted hover:text-fg'}"
										>
											<child.icon class="size-4 shrink-0" />
											<span class="min-w-0 flex-1 truncate">{child.label}</span>
											{#if current}
												<CheckIcon class="text-accent size-4 shrink-0" strokeWidth={3} />
											{/if}
										</a>
									</li>
								{/each}
							</ul>

							<!-- A little tail, so the card reads as belonging to the tab below. -->
							<span
								aria-hidden="true"
								class="bg-surface border-border absolute -bottom-1.5 size-3 rotate-45 border-r border-b"
								style={caretStyle(index)}
							></span>
						</div>
					{/if}
				{:else}
					<a
						href={link.href}
						aria-current={active ? 'page' : undefined}
						class="relative flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors duration-150 {active
							? 'text-accent'
							: 'text-fg-muted hover:text-fg'}"
					>
						<span class="relative">
							<link.icon class="size-5" />
							{#if link.href === '/shopping' && shoppingCount > 0}
								<Badge
									tone="accent"
									class="absolute -top-1.5 -right-2.5 min-w-4 justify-center px-1 py-0 text-[0.625rem]"
								>
									{shoppingCount}
								</Badge>
							{/if}
						</span>
						{link.label}
					</a>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
