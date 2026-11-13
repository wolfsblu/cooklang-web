<script lang="ts">
	import { page } from '$app/state';
	import { CircleHelpIcon, FolderIcon, SlidersHorizontalIcon } from '@lucide/svelte';
	import type { LayoutProps } from './$types';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Page from '$lib/components/ui/Page.svelte';
	import { countLabel } from '$lib/utils/pluralize';

	const { data, children }: LayoutProps = $props();

	// Route-backed tabs: plain links, so back/forward and no-JS both work, and the
	// active one is decided by the pathname rather than a query param -- browsing
	// a single aisle (?category=) keeps "Ingredients" selected. Managing the
	// aisles comes first because everything else here is grouped by them.
	const tabs = [
		{ href: '/aisles', label: 'Manage aisles', icon: SlidersHorizontalIcon },
		{ href: '/aisles/ingredients', label: 'Ingredients', icon: FolderIcon },
		{ href: '/aisles/unassigned', label: 'Unassigned', icon: CircleHelpIcon }
	];

	const current = $derived(page.url.pathname);

	const base =
		'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-4';
	const active = 'border-accent text-fg';
	const idle = 'border-transparent text-fg-muted hover:text-fg hover:border-border';
</script>

<Page full flush class="flex h-full min-h-0 flex-col">
	<h1 class="sr-only">Aisles</h1>

	<!--
		One workbench for the whole section: the tabs are a strip inside the same
		frame as the routed page, and the status bar closes the bottom edge.
		Keeping the frame in the layout means it persists as you move between the
		three tabs. The frame fills the viewport; only the routed pane scrolls.
	-->
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<nav
			aria-label="Aisle tabs"
			class="border-border no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b px-2"
		>
			{#each tabs as tab (tab.href)}
				{@const isActive = current === tab.href}
				<a
					href={tab.href}
					aria-current={isActive ? 'page' : undefined}
					class="{base} {isActive ? active : idle}"
				>
					<tab.icon class="size-4 shrink-0" />
					{tab.label}
					{#if tab.href === '/aisles/unassigned' && data.unassignedCount > 0}
						<Badge tone="warn">{data.unassignedCount}</Badge>
					{/if}
				</a>
			{/each}
		</nav>

		<div class="min-h-0 flex-1 overflow-hidden">
			{@render children()}
		</div>

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-1.5 text-xs"
		>
			<span class="tabular-nums">{countLabel(data.categories.length, 'aisle')}</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{countLabel(data.total, 'ingredient')}</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{data.unassignedCount} unassigned</span>
		</footer>
	</div>
</Page>
