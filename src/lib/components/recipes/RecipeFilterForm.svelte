<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/components/ui/Button.svelte';
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
	import RangeSlider from '$lib/components/ui/RangeSlider.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { buildFilterUrl, parseFilterParams } from '$lib/utils/url-params';
	import type { FilterState } from '$lib/utils/recipe-filters';

	/**
	 * The filter controls, shared by the desktop sidebar and the mobile drawer.
	 *
	 * The URL stays the source of truth: every change writes a new query
	 * string immediately, and the effect below copies the query string back
	 * into the controls. That keeps an open drawer in step with the results
	 * and means there is no pending draft that can drift from what is applied.
	 */
	type Props = {
		/** Facets come from the whole library, not the filtered view. */
		allTags: string[];
		allIngredients: string[];
		allCourses: string[];
		class?: string;
	};

	const { allTags, allIngredients, allCourses, class: className }: Props = $props();

	/** Slider ceilings; at the top of the range the filter means "no upper bound". */
	const TIME_MAX = 180;
	const SERVINGS_MAX = 12;

	// Seed from the URL so the server-rendered sidebar already reflects the
	// applied filters; the effect below keeps it in step afterwards.
	const initial = parseFilterParams(page.url.searchParams);

	let selectedTags = $state<string[]>([...initial.tags]);
	let selectedIngredients = $state<string[]>([...initial.ingredients]);
	let selectedCourse = $state(initial.course ?? '');
	let timeRange = $state<number[]>([
		initial.timeRange.min,
		initial.timeRange.max === Infinity ? TIME_MAX : initial.timeRange.max
	]);
	let servingsRange = $state<number[]>([
		initial.servingsRange.min,
		initial.servingsRange.max === Infinity ? SERVINGS_MAX : initial.servingsRange.max
	]);

	const courseOptions = $derived([
		{ value: '', label: 'Any course' },
		...allCourses.map((course) => ({ value: course, label: course }))
	]);

	$effect(() => {
		const current = parseFilterParams(page.url.searchParams);
		selectedTags = [...current.tags];
		selectedIngredients = [...current.ingredients];
		selectedCourse = current.course ?? '';
		timeRange = [
			current.timeRange.min,
			current.timeRange.max === Infinity ? TIME_MAX : current.timeRange.max
		];
		servingsRange = [
			current.servingsRange.min,
			current.servingsRange.max === Infinity ? SERVINGS_MAX : current.servingsRange.max
		];
	});

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
	 * changed value arrives as an argument because the bound state and the
	 * navigation happen in the same tick.
	 */
	function commit(
		changes: Partial<{
			tags: string[];
			ingredients: string[];
			course: string | null;
			timeRange: number[];
			servingsRange: number[];
		}>
	) {
		const tags = changes.tags ?? selectedTags;
		const ingredients = changes.ingredients ?? selectedIngredients;
		const course = changes.course === undefined ? selectedCourse || null : changes.course;
		const time = changes.timeRange ?? timeRange;
		const servings = changes.servingsRange ?? servingsRange;

		navigate({
			tags,
			ingredients,
			course,
			timeRange: {
				min: time[0],
				max: time[1] >= TIME_MAX ? Infinity : time[1]
			},
			servingsRange: {
				min: servings[0],
				max: servings[1] >= SERVINGS_MAX ? Infinity : servings[1]
			}
		});
	}

	function applyTags(tags: string[]) {
		selectedTags = tags;
		commit({ tags });
	}

	function applyIngredients(ingredients: string[]) {
		selectedIngredients = ingredients;
		commit({ ingredients });
	}

	function applyCourse(course: string) {
		selectedCourse = course;
		commit({ course: course || null });
	}

	function applyTime(range: number[]) {
		timeRange = range;
		commit({ timeRange: range });
	}

	function applyServings(range: number[]) {
		servingsRange = range;
		commit({ servingsRange: range });
	}

	/** Clear every filter in one go; search and sort are left alone. */
	function clearAll() {
		selectedTags = [];
		selectedIngredients = [];
		selectedCourse = '';
		timeRange = [0, TIME_MAX];
		servingsRange = [0, SERVINGS_MAX];

		navigate({
			tags: [],
			ingredients: [],
			course: null,
			timeRange: { min: 0, max: Infinity },
			servingsRange: { min: 0, max: Infinity }
		});
	}
</script>

<div class="space-y-6 {className ?? ''}">
	{#if allTags.length > 0}
		<div>
			<h3 class="text-fg mb-2 text-sm font-medium">Tags</h3>
			<MultiSelect
				bind:selected={selectedTags}
				options={allTags}
				label="Tags"
				onchange={applyTags}
			/>
		</div>
	{/if}

	{#if allIngredients.length > 0}
		<div>
			<h3 class="text-fg mb-2 text-sm font-medium">Ingredients</h3>
			<MultiSelect
				bind:selected={selectedIngredients}
				options={allIngredients}
				label="Ingredients"
				onchange={applyIngredients}
			/>
		</div>
	{/if}

	{#if allCourses.length > 0}
		<div>
			<h3 class="text-fg mb-2 text-sm font-medium">Course</h3>
			<Select
				bind:value={selectedCourse}
				options={courseOptions}
				label="Course"
				onchange={applyCourse}
			/>
		</div>
	{/if}

	<div>
		<div class="mb-2 flex items-center justify-between">
			<h3 class="text-fg text-sm font-medium">Cooking time</h3>
			<span class="text-fg-muted text-sm tabular-nums">
				{timeRange[0]}–{timeRange[1] >= TIME_MAX ? '180+' : timeRange[1]} min
			</span>
		</div>
		<RangeSlider
			bind:value={timeRange}
			min={0}
			max={TIME_MAX}
			step={5}
			label="Cooking time"
			oncommit={applyTime}
		/>
	</div>

	<div>
		<div class="mb-2 flex items-center justify-between">
			<h3 class="text-fg text-sm font-medium">Servings</h3>
			<span class="text-fg-muted text-sm tabular-nums">
				{servingsRange[0]}–{servingsRange[1] >= SERVINGS_MAX ? '12+' : servingsRange[1]}
			</span>
		</div>
		<RangeSlider
			bind:value={servingsRange}
			min={0}
			max={SERVINGS_MAX}
			step={1}
			label="Servings"
			oncommit={applyServings}
		/>
	</div>

	<Button variant="ghost" block onclick={clearAll}>Clear all</Button>
</div>
