<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/components/ui/Button.svelte';
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
	import RangeSlider from '$lib/components/ui/RangeSlider.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import type { FilterState } from '$lib/utils/recipe-filters';
	import {
		buildFilterUrl,
		filterStateFromDraft,
		parseFilterDraft,
		MAX_FILTER_SERVINGS,
		MAX_FILTER_TIME,
		type FilterDraft
	} from '$lib/utils/url-params';

	/**
	 * The filter controls, shared by the desktop sidebar and the mobile drawer.
	 *
	 * The URL stays the source of truth. A change writes a new query string
	 * immediately, and the writable `$derived` draft is recalculated from the
	 * URL when that navigation lands, so an open drawer can never drift from
	 * the applied filters — including after back/forward.
	 */
	type Props = {
		/** Facets come from the whole library, not the filtered view. */
		allTags: string[];
		allIngredients: string[];
		allCourses: string[];
		class?: string;
	};

	const { allTags, allIngredients, allCourses, class: className }: Props = $props();

	// The URL is the source of truth. A writable `$derived` keeps the controls
	// in step with back/forward, while a change made here temporarily
	// overrides it until the navigation lands.
	let draft = $derived(parseFilterDraft(page.url.searchParams));

	const courseOptions = $derived([
		{ value: '', label: 'Any course' },
		...allCourses.map((course) => ({ value: course, label: course }))
	]);

	function navigate(filters: FilterState) {
		const url = buildFilterUrl(
			page.url.searchParams.get('q') || '',
			filters,
			page.url.searchParams.get('sort') || 'name',
			(page.url.searchParams.get('order') || 'asc') as 'asc' | 'desc'
		);

		goto(url, { keepFocus: true, noScroll: true });
	}

	/**
	 * Commit one changed control, keeping the other controls as they are. The
	 * changed value arrives as an argument because the draft and the
	 * navigation happen in the same tick.
	 */
	function commit(changes: Partial<FilterDraft> = {}) {
		draft = { ...draft, ...changes };
		navigate(filterStateFromDraft(draft));
	}

	/** The slider labels follow the thumb while it is being dragged. */
	function previewTime(range: number[]) {
		draft = { ...draft, timeRange: range };
	}

	function previewServings(range: number[]) {
		draft = { ...draft, servingsRange: range };
	}

	function applyTags(tags: string[]) {
		commit({ tags });
	}

	function applyIngredients(ingredients: string[]) {
		commit({ ingredients });
	}

	function applyCourse(course: string) {
		commit({ course });
	}

	function applyTime(range: number[]) {
		commit({ timeRange: range });
	}

	function applyServings(range: number[]) {
		commit({ servingsRange: range });
	}

	/** Clear every filter in one go; search and sort are left alone. */
	function clearAll() {
		draft = parseFilterDraft(new URLSearchParams());
		navigate(filterStateFromDraft(draft));
	}
</script>

<div class="space-y-6 {className ?? ''}">
	{#if allTags.length > 0}
		<div>
			<h3 class="text-fg mb-2 text-sm font-medium">Tags</h3>
			<MultiSelect selected={draft.tags} options={allTags} label="Tags" onchange={applyTags} />
		</div>
	{/if}

	{#if allIngredients.length > 0}
		<div>
			<h3 class="text-fg mb-2 text-sm font-medium">Ingredients</h3>
			<MultiSelect
				selected={draft.ingredients}
				options={allIngredients}
				label="Ingredients"
				onchange={applyIngredients}
			/>
		</div>
	{/if}

	{#if allCourses.length > 0}
		<div>
			<h3 class="text-fg mb-2 text-sm font-medium">Course</h3>
			<Select value={draft.course} options={courseOptions} label="Course" onchange={applyCourse} />
		</div>
	{/if}

	<div>
		<div class="mb-2 flex items-center justify-between">
			<h3 class="text-fg text-sm font-medium">Cooking time</h3>
			<span class="text-fg-muted text-sm tabular-nums">
				{draft.timeRange[0]}–{draft.timeRange[1] >= MAX_FILTER_TIME
					? `${MAX_FILTER_TIME}+`
					: draft.timeRange[1]} min
			</span>
		</div>
		<RangeSlider
			value={draft.timeRange}
			min={0}
			max={MAX_FILTER_TIME}
			step={5}
			label="Cooking time"
			onchange={previewTime}
			oncommit={applyTime}
		/>
	</div>

	<div>
		<div class="mb-2 flex items-center justify-between">
			<h3 class="text-fg text-sm font-medium">Servings</h3>
			<span class="text-fg-muted text-sm tabular-nums">
				{draft.servingsRange[0]}–{draft.servingsRange[1] >= MAX_FILTER_SERVINGS
					? `${MAX_FILTER_SERVINGS}+`
					: draft.servingsRange[1]}
			</span>
		</div>
		<RangeSlider
			value={draft.servingsRange}
			min={0}
			max={MAX_FILTER_SERVINGS}
			step={1}
			label="Servings"
			onchange={previewServings}
			oncommit={applyServings}
		/>
	</div>

	<Button variant="ghost" block onclick={clearAll}>Clear all</Button>
</div>
