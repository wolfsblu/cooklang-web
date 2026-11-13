<script lang="ts">
	import { page } from '$app/state';
	import { SearchXIcon } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import FilterDrawer from '$lib/components/recipes/FilterDrawer.svelte';
	import RecipeCard from '$lib/components/recipes/RecipeCard.svelte';
	import RecipeFilterForm from '$lib/components/recipes/RecipeFilterForm.svelte';
	import RecipeFilters from '$lib/components/recipes/RecipeFilters.svelte';
	import RecipePagination from '$lib/components/recipes/RecipePagination.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Page from '$lib/components/ui/Page.svelte';
	import { parseFilterParams } from '$lib/utils/url-params';

	const { data }: PageProps = $props();

	let isDrawerOpen = $state(false);
	// The sidebar is permanent from `lg`; the toolbar toggle can still fold it
	// away on a narrow laptop, the way a workbench pane does.
	let sidebarOpen = $state(true);

	const SORT_LABELS: Record<string, string> = {
		name: 'Name',
		time: 'Time',
		servings: 'Servings'
	};

	// Filtering, sorting and paging all happen in the load function; the params
	// are still read here for the summaries, toolbar and empty state.
	const filters = $derived(parseFilterParams(page.url.searchParams));

	const activeFilterCount = $derived(
		(filters.tags.length > 0 ? 1 : 0) +
			(filters.course !== null ? 1 : 0) +
			(filters.timeRange.min > 0 || filters.timeRange.max !== Infinity ? 1 : 0) +
			(filters.servingsRange.min > 0 || filters.servingsRange.max !== Infinity ? 1 : 0)
	);

	const activeFilterSummary = $derived.by(() => {
		const parts: string[] = [];

		if (filters.tags.length > 0) parts.push(filters.tags.join(', '));
		if (filters.course) parts.push(filters.course);

		const { min: timeMin, max: timeMax } = filters.timeRange;
		if (timeMin > 0 || timeMax !== Infinity) {
			parts.push(timeMax === Infinity ? `${timeMin}+ min` : `${timeMin}–${timeMax} min`);
		}

		const { min: servingsMin, max: servingsMax } = filters.servingsRange;
		if (servingsMin > 0 || servingsMax !== Infinity) {
			parts.push(
				servingsMax === Infinity
					? `${servingsMin}+ servings`
					: `${servingsMin}–${servingsMax} servings`
			);
		}

		return parts;
	});

	const sortSummary = $derived(
		`${SORT_LABELS[page.url.searchParams.get('sort') || 'name'] ?? 'Name'} ${
			page.url.searchParams.get('order') === 'desc' ? 'descending' : 'ascending'
		}`
	);

	const hasQuery = $derived(Boolean(data.searchQuery) || activeFilterCount > 0);
</script>

<svelte:head>
	<title>Recipes</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<!--
		The recipe list as a workbench, matching the recipe detail, aisles,
		pantry and shopping pages: a title bar, filter sidebar, scrolling grid
		pane and status bar share one frame with hairline dividers. Only the
		sidebar and the grid scroll.
	-->
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<div class="flex min-h-0 flex-1 flex-col">
			<header
				class="border-border bg-surface flex shrink-0 flex-wrap items-center border-b md:gap-x-3 md:px-4 md:py-2"
			>
				<div class="hidden min-w-0 flex-1 items-center gap-3 md:flex md:px-0 md:py-0">
					<div class="min-w-0 flex-1">
						<h1 class="text-fg truncate text-base font-semibold">Recipes</h1>
						<p class="text-fg-subtle truncate text-xs">
							<span class="tabular-nums">
								{data.totalRecipes}
								{data.totalRecipes === 1 ? 'recipe' : 'recipes'}
							</span>
							{#if activeFilterSummary.length > 0}
								<span class="text-border" aria-hidden="true">·</span>
								<span>{activeFilterSummary.join(', ')}</span>
							{/if}
						</p>
					</div>
				</div>

				<!-- The flat toolbar sits inline with the title from `md` up. -->
				<div class="hidden md:block">
					<RecipeFilters
						{activeFilterCount}
						{sidebarOpen}
						onopenfilters={() => (isDrawerOpen = true)}
						ontogglesidebar={() => (sidebarOpen = !sidebarOpen)}
					/>
				</div>

				<!-- On phones it gets a toolbar strip of its own, as on the recipe
				     detail page, rather than squeezing the heading. -->
				<div class="bg-surface-muted/30 flex w-full items-center justify-end px-3 py-1.5 md:hidden">
					<RecipeFilters
						{activeFilterCount}
						{sidebarOpen}
						onopenfilters={() => (isDrawerOpen = true)}
						ontogglesidebar={() => (sidebarOpen = !sidebarOpen)}
					/>
				</div>
			</header>

			<div
				class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] {sidebarOpen
					? 'lg:grid-cols-[17rem_minmax(0,1fr)]'
					: ''}"
			>
				<!-- The sidebar is hidden below `lg`, where the same controls live
				     in the drawer. It scrolls independently of the grid. -->
				<aside
					class="border-border bg-surface-muted/40 hidden min-h-0 min-w-0 border-r {sidebarOpen
						? 'lg:flex lg:flex-col'
						: ''}"
					aria-label="Recipe filters"
				>
					<div class="flex h-full min-h-0 flex-col">
						<div
							class="border-border flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2"
						>
							<h2 class="text-fg text-sm font-semibold">Filters</h2>
							{#if activeFilterCount > 0}
								<span class="text-fg-subtle text-xs tabular-nums">
									{activeFilterCount} active
								</span>
							{/if}
						</div>

						<div class="min-h-0 flex-1 overflow-y-auto p-4">
							<RecipeFilterForm allTags={data.allTags} allCourses={data.allCourses} />
						</div>
					</div>
				</aside>

				<section class="bg-surface flex min-h-0 min-w-0 flex-col" aria-label="Recipes">
					<!-- The only scrolling region: the workbench chrome above and
					     below stays put while the cards move. -->
					<div class="min-h-0 flex-1 overflow-y-auto">
						{#if data.totalRecipes === 0}
							<EmptyState
								icon={SearchXIcon}
								title="No recipes found"
								description={hasQuery
									? 'Nothing matches the current search and filters.'
									: 'No recipes were found in the recipe directory.'}
							>
								{#snippet actions()}
									{#if hasQuery}
										<Button href="/" variant="outline">Clear search and filters</Button>
									{/if}
								{/snippet}
							</EmptyState>
						{:else}
							<div
								class="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 xl:grid-cols-3 2xl:grid-cols-4"
							>
								{#each data.recipes as recipe (recipe.slug)}
									<RecipeCard {recipe} />
								{/each}
							</div>
						{/if}
					</div>
				</section>
			</div>
		</div>

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-3 py-1.5 text-xs sm:px-4"
		>
			<span class="tabular-nums">
				{data.totalRecipes}
				{data.totalRecipes === 1 ? 'recipe' : 'recipes'}
			</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">page {data.pageNumber} of {data.totalPages}</span>

			{#if activeFilterSummary.length > 0}
				<span class="text-border" aria-hidden="true">·</span>
				<span class="min-w-0 truncate">filters: {activeFilterSummary.join(', ')}</span>
			{/if}

			<span class="ml-auto flex shrink-0 items-center gap-3">
				<span class="tabular-nums">{sortSummary}</span>
				<RecipePagination pageNumber={data.pageNumber} totalPages={data.totalPages} />
			</span>
		</footer>
	</div>
</Page>

<FilterDrawer bind:isOpen={isDrawerOpen} allTags={data.allTags} allCourses={data.allCourses} />
