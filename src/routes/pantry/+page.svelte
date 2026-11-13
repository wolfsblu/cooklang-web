<script lang="ts">
	import { page } from '$app/state';
	import { PlusIcon, RefrigeratorIcon } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import type { PantryItemView } from '$lib/types/pantry';
	import PantryActionBar from '$lib/components/pantry/PantryActionBar.svelte';
	import PantryFolderDialog from '$lib/components/pantry/PantryFolderDialog.svelte';
	import PantryFolderList from '$lib/components/pantry/PantryFolderList.svelte';
	import PantryFilters, { type PantryFilter } from '$lib/components/pantry/PantryFilters.svelte';
	import PantryItemDialog from '$lib/components/pantry/PantryItemDialog.svelte';
	import PantryItemTable, {
		type SortDirection,
		type SortKey
	} from '$lib/components/pantry/PantryItemTable.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Page from '$lib/components/ui/Page.svelte';
	import { countLabel } from '$lib/utils/pluralize';

	const { data }: PageProps = $props();

	let filter = $state<PantryFilter>('all');

	// Sort stays out of the URL: switching folders navigates within the same
	// route, so the component is not remounted and the choice survives anyway.
	let sort = $state<SortKey>('name');
	let direction = $state<SortDirection>('asc');

	let dialogOpen = $state(false);
	let editing = $state<PantryItemView | null>(null);
	let dialogSection = $state('');

	let renameOpen = $state(false);

	/** The folder being browsed, or null for "All items". */
	const folder = $derived.by(() => {
		const requested = page.url.searchParams.get('folder');
		// A folder that no longer exists falls back to the root rather than
		// showing an empty pane for something that cannot be selected.
		return requested && data.sections.includes(requested) ? requested : null;
	});

	const counts = $derived.by(() => {
		const bySection: Record<string, number> = {};
		for (const section of data.sections) bySection[section] = 0;
		for (const item of data.items) bySection[item.section] = (bySection[item.section] ?? 0) + 1;
		return bySection;
	});

	function matchesFilter(item: PantryItemView): boolean {
		if (filter === 'low') return item.runningLow && !item.disabled;
		if (filter === 'expiring') return item.expiringSoon && !item.disabled;
		return true;
	}

	/**
	 * Items with no quantity or no expiry date sink to the bottom either way:
	 * reversing the sort should not promote the rows that have nothing to sort by.
	 */
	function byNumber(a: number | null, b: number | null, flip: number): number {
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		return flip * (a - b);
	}

	function compare(a: PantryItemView, b: PantryItemView): number {
		const flip = direction === 'asc' ? 1 : -1;
		switch (sort) {
			case 'quantity':
				return byNumber(a.sortAmount, b.sortAmount, flip) || a.name.localeCompare(b.name);
			case 'location':
				return flip * a.section.localeCompare(b.section) || a.name.localeCompare(b.name);
			case 'expires':
				return byNumber(a.daysLeft, b.daysLeft, flip) || a.name.localeCompare(b.name);
			default:
				return flip * a.name.localeCompare(b.name);
		}
	}

	const visibleItems = $derived(
		data.items
			.filter((item) => (folder === null || item.section === folder) && matchesFilter(item))
			.sort(compare)
	);

	function onsort(key: SortKey) {
		if (sort === key) {
			direction = direction === 'asc' ? 'desc' : 'asc';
		} else {
			sort = key;
			direction = 'asc';
		}
	}

	function openAdd() {
		editing = null;
		dialogSection = folder ?? data.sections[0] ?? '';
		dialogOpen = true;
	}

	function openEdit(item: PantryItemView) {
		editing = item;
		dialogSection = item.section;
		dialogOpen = true;
	}
</script>

<svelte:head>
	<title>Pantry</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<h1 class="sr-only">Pantry</h1>

	<!--
		One workbench rather than a stack of cards: the folder sidebar, toolbar
		strips and status bar share a single frame with hairline dividers. The
		frame fills the viewport; only the folder and item panes scroll.
	-->
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<div class="grid min-h-0 flex-1 grid-rows-[auto_1fr] lg:grid-cols-[15rem_1fr] lg:grid-rows-1">
			<!-- min-w-0 so the folder strip can scroll sideways instead of widening
			     the page: a grid item defaults to min-width:auto. Each pane owns its
			     own scroll, so the workbench itself never scrolls. -->
			<aside
				class="border-border bg-surface-muted/40 min-h-0 min-w-0 border-b lg:overflow-hidden lg:border-r lg:border-b-0"
			>
				<PantryFolderList
					sections={data.sections}
					{counts}
					total={data.items.length}
					selected={folder}
				/>
			</aside>

			<div class="bg-surface flex min-h-0 min-w-0 flex-col">
				{#if data.sections.length === 0}
					<div class="min-h-0 flex-1 overflow-y-auto">
						<EmptyState
							icon={RefrigeratorIcon}
							title="Your pantry is empty"
							description="Add a folder such as fridge, pantry or spices to start tracking what you have."
						/>
					</div>
				{:else}
					<!-- The folder title and its toolbar share a row from `md` up; on
					     phones the toolbar gets a strip of its own, as on the recipe
					     detail page, rather than squeezing the folder name. -->
					<header
						class="border-border flex shrink-0 flex-wrap items-center border-b md:gap-x-3 md:px-4 md:py-2"
					>
						<div class="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5 md:px-0 md:py-0">
							<h2 class="text-fg flex min-w-0 items-baseline gap-2 text-sm font-semibold">
								<!-- capitalize is for folder names as written in the file; the
								     literal label is already spelled the way it should read. -->
								<span class="truncate" class:capitalize={folder}>
									{folder ?? 'All items'}
								</span>
								<span class="text-fg-subtle shrink-0 text-xs font-normal tabular-nums">
									{countLabel(visibleItems.length, 'item')}
								</span>
							</h2>
						</div>

						<!-- Phones: the filters scroll sideways when they do not fit, while
						     the folder actions stay pinned at the right so every action
						     remains reachable without scrolling. -->
						<div
							class="border-border bg-surface-muted/30 flex w-full min-w-0 items-center gap-2 border-t px-3 py-1.5 md:hidden"
						>
							<div class="no-scrollbar min-w-0 flex-1 overflow-x-auto">
								<PantryFilters
									{filter}
									lowCount={data.lowCount}
									expiringCount={data.expiringCount}
									onchange={(next) => (filter = next)}
								/>
							</div>

							<span class="bg-border h-5 w-px shrink-0" aria-hidden="true"></span>

							<div class="shrink-0">
								<PantryActionBar
									{folder}
									itemCount={folder ? (counts[folder] ?? 0) : 0}
									onadd={openAdd}
									onrename={() => (renameOpen = true)}
									compact
								/>
							</div>
						</div>

						<!-- From `md` up the actions sit inline with the folder title. -->
						<div class="hidden md:ml-auto md:flex md:shrink-0 md:items-center">
							<PantryActionBar
								{folder}
								itemCount={folder ? (counts[folder] ?? 0) : 0}
								onadd={openAdd}
								onrename={() => (renameOpen = true)}
							/>
						</div>
					</header>

					<div
						class="border-border hidden shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 md:flex"
					>
						<PantryFilters
							{filter}
							lowCount={data.lowCount}
							expiringCount={data.expiringCount}
							onchange={(next) => (filter = next)}
						/>
					</div>

					<!-- The only scrolling region: the workbench chrome above and
					     below stays put while the table moves. -->
					<div class="min-h-0 flex-1 overflow-y-auto">
						{#if visibleItems.length > 0}
							<PantryItemTable
								items={visibleItems}
								showLocation={folder === null}
								{sort}
								{direction}
								{onsort}
								onedit={openEdit}
							/>
						{:else if filter !== 'all'}
							<EmptyState
								icon={RefrigeratorIcon}
								title={filter === 'low' ? 'Nothing is running low' : 'Nothing is expiring soon'}
								description="Set a “low at” threshold or an expiry date on an item to track it here."
							>
								{#snippet actions()}
									<Button variant="outline" onclick={() => (filter = 'all')}>Show everything</Button
									>
								{/snippet}
							</EmptyState>
						{:else}
							<EmptyState
								icon={RefrigeratorIcon}
								title={folder ? `Nothing in ${folder} yet` : 'Nothing in your pantry yet'}
								description="Add what you keep on hand and it will be deducted from your shopping list."
							>
								{#snippet actions()}
									<Button variant="outline" onclick={openAdd}>
										<PlusIcon class="size-4" />
										Add item
									</Button>
								{/snippet}
							</EmptyState>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-1.5 text-xs"
		>
			<span class="tabular-nums">{countLabel(data.sections.length, 'folder')}</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{countLabel(data.items.length, 'item')}</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{data.lowCount} low</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{data.expiringCount} expiring</span>
		</footer>
	</div>
</Page>

<PantryItemDialog
	bind:open={dialogOpen}
	item={editing}
	section={dialogSection}
	sections={data.sections}
/>

{#if folder}
	<PantryFolderDialog bind:open={renameOpen} {folder} />
{/if}
