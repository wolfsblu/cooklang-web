<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ArrowDownIcon,
		ArrowUpIcon,
		FilterXIcon,
		FunnelIcon,
		PanelLeftIcon
	} from '@lucide/svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { buildFilterUrl, buildSortUrl, EMPTY_FILTER_STATE } from '$lib/utils/url-params';

	/**
	 * The flat toolbar in the recipe list's title bar: filter toggles, sort
	 * field and direction, and a clear-filters action.
	 *
	 * It deliberately mirrors RecipeActionBar rather than using labelled
	 * buttons: small icon controls with tooltips keep the title readable on a
	 * tablet, and the sort field is the only control that needs a label.
	 */
	type Props = {
		activeFilterCount?: number;
		/** Desktop sidebar visibility, for the toggle's label and aria state. */
		sidebarOpen?: boolean;
		/** Opens the drawer, used below `lg`. */
		onopenfilters: () => void;
		/** Toggles the permanent sidebar, used from `lg` up. */
		ontogglesidebar: () => void;
	};

	const {
		activeFilterCount = 0,
		sidebarOpen = true,
		onopenfilters,
		ontogglesidebar
	}: Props = $props();

	const SORT_OPTIONS = [
		{ value: 'name', label: 'Name' },
		{ value: 'time', label: 'Time' },
		{ value: 'servings', label: 'Servings' }
	];

	let sortField = $state(page.url.searchParams.get('sort') || 'name');
	let sortOrder = $state<'asc' | 'desc'>(
		(page.url.searchParams.get('order') || 'asc') as 'asc' | 'desc'
	);

	// Keep the selected sort in step with back/forward and any other
	// navigation, so the control never shows a stale order.
	$effect(() => {
		sortField = page.url.searchParams.get('sort') || 'name';
		sortOrder = (page.url.searchParams.get('order') || 'asc') as 'asc' | 'desc';
	});

	function updateUrl() {
		goto(buildSortUrl(page.url.searchParams, sortField, sortOrder), {
			keepFocus: true,
			noScroll: true
		});
	}

	function toggleSortOrder() {
		sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		updateUrl();
	}

	function clearFilters() {
		const url = buildFilterUrl(
			page.url.searchParams.get('q') || '',
			EMPTY_FILTER_STATE,
			sortField,
			sortOrder
		);

		goto(url, { keepFocus: true, noScroll: true });
	}
</script>

<div class="flex items-center gap-0.5" role="toolbar" aria-label="Recipe list controls">
	<IconButton
		label="Open filters"
		variant="toolbar"
		size="sm"
		class="lg:hidden"
		onclick={onopenfilters}
	>
		<FunnelIcon class="size-4" />
	</IconButton>

	<IconButton
		label={sidebarOpen ? 'Hide filters' : 'Show filters'}
		variant="toolbar"
		size="sm"
		class="hidden lg:inline-flex"
		aria-expanded={sidebarOpen}
		onclick={ontogglesidebar}
	>
		<PanelLeftIcon class="size-4" />
	</IconButton>

	<span class="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>

	<Select
		bind:value={sortField}
		options={SORT_OPTIONS}
		label="Sort by"
		class="h-8 w-28 py-1 text-xs"
		onchange={updateUrl}
	/>

	<IconButton
		label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
		variant="toolbar"
		size="sm"
		onclick={toggleSortOrder}
	>
		{#if sortOrder === 'asc'}
			<ArrowUpIcon class="size-4" />
		{:else}
			<ArrowDownIcon class="size-4" />
		{/if}
	</IconButton>

	{#if activeFilterCount > 0}
		<span class="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>

		<IconButton label="Clear filters" variant="toolbar" size="sm" onclick={clearFilters}>
			<FilterXIcon class="size-4" />
		</IconButton>
	{/if}
</div>
