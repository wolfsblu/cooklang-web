/**
 * URL parameter utilities for filter state management
 */

import type { FilterState } from './recipe-filters';

/** Slider ceilings; at the top of the range the filter means "no upper bound". */
export const MAX_FILTER_TIME = 180;
export const MAX_FILTER_SERVINGS = 12;

/** A filter control's local draft: same data, shaped for the widgets. */
export interface FilterDraft {
	tags: string[];
	ingredients: string[];
	course: string;
	timeRange: number[];
	servingsRange: number[];
}

/**
 * Parse filter parameters from URL search params
 */
export function parseFilterParams(searchParams: URLSearchParams): FilterState {
	return {
		tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
		ingredients: searchParams.get('ingredients')?.split(',').filter(Boolean) || [],
		course: searchParams.get('course') || null,
		timeRange: {
			min: Number(searchParams.get('time_min')) || 0,
			max: Number(searchParams.get('time_max')) || Infinity
		},
		servingsRange: {
			min: Number(searchParams.get('servings_min')) || 0,
			max: Number(searchParams.get('servings_max')) || Infinity
		}
	};
}

/**
 * The URL's filters as a draft the controls can bind to.
 *
 * The sliders need concrete numbers, so an unbounded maximum becomes the
 * slider's ceiling; `filterStateFromDraft` converts it back.
 */
export function parseFilterDraft(searchParams: URLSearchParams): FilterDraft {
	const filters = parseFilterParams(searchParams);

	return {
		tags: [...filters.tags],
		ingredients: [...filters.ingredients],
		course: filters.course ?? '',
		timeRange: [
			filters.timeRange.min,
			filters.timeRange.max === Infinity ? MAX_FILTER_TIME : filters.timeRange.max
		],
		servingsRange: [
			filters.servingsRange.min,
			filters.servingsRange.max === Infinity ? MAX_FILTER_SERVINGS : filters.servingsRange.max
		]
	};
}

/** Turn a control draft back into the filter state the load function reads. */
export function filterStateFromDraft(draft: FilterDraft): FilterState {
	return {
		tags: draft.tags,
		ingredients: draft.ingredients,
		course: draft.course || null,
		timeRange: {
			min: draft.timeRange[0],
			max: draft.timeRange[1] >= MAX_FILTER_TIME ? Infinity : draft.timeRange[1]
		},
		servingsRange: {
			min: draft.servingsRange[0],
			max: draft.servingsRange[1] >= MAX_FILTER_SERVINGS ? Infinity : draft.servingsRange[1]
		}
	};
}

/** The filter state that means "everything", used by both clear actions. */
export const EMPTY_FILTER_STATE: FilterState = {
	tags: [],
	ingredients: [],
	course: null,
	timeRange: { min: 0, max: Infinity },
	servingsRange: { min: 0, max: Infinity }
};

/**
 * Build URL from filter state.
 *
 * Deliberately built from an empty URLSearchParams: applying filters produces a
 * different result set, so dropping `page` and landing back on the first page
 * is the wanted behaviour rather than an oversight.
 */
export function buildFilterUrl(
	query: string,
	filters: FilterState,
	sortField: string,
	sortOrder: 'asc' | 'desc'
): string {
	const params = new URLSearchParams();

	if (query) params.set('q', query);
	if (filters.tags.length) params.set('tags', filters.tags.join(','));
	if (filters.ingredients.length) params.set('ingredients', filters.ingredients.join(','));
	if (filters.course) params.set('course', filters.course);
	if (filters.timeRange.min > 0) params.set('time_min', String(filters.timeRange.min));
	if (filters.timeRange.max !== Infinity) params.set('time_max', String(filters.timeRange.max));
	if (filters.servingsRange.min > 0) params.set('servings_min', String(filters.servingsRange.min));
	if (filters.servingsRange.max !== Infinity)
		params.set('servings_max', String(filters.servingsRange.max));
	if (sortField !== 'name') params.set('sort', sortField);
	if (sortOrder !== 'asc') params.set('order', sortOrder);

	const queryString = params.toString();
	return queryString ? `?${queryString}` : '/';
}

/**
 * Change only the sort field/order, keeping search and filters.
 *
 * Re-sorting reshuffles the whole list, so page 3 of the old order is dropped.
 */
export function buildSortUrl(
	searchParams: URLSearchParams,
	sortField: string,
	sortOrder: 'asc' | 'desc'
): string {
	const params = new URLSearchParams(searchParams);
	params.delete('page');

	if (sortField !== 'name') params.set('sort', sortField);
	else params.delete('sort');

	if (sortOrder !== 'asc') params.set('order', sortOrder);
	else params.delete('order');

	const query = params.toString();
	return query ? `?${query}` : '/';
}
