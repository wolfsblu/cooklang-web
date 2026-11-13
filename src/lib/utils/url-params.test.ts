import { describe, expect, it } from 'vitest';
import {
	buildFilterUrl,
	buildSortUrl,
	EMPTY_FILTER_STATE,
	filterStateFromDraft,
	MAX_FILTER_SERVINGS,
	MAX_FILTER_TIME,
	parseFilterDraft,
	parseFilterParams
} from './url-params';
import type { FilterState } from './recipe-filters';

const EMPTY: FilterState = {
	tags: [],
	ingredients: [],
	course: null,
	timeRange: { min: 0, max: Infinity },
	servingsRange: { min: 0, max: Infinity }
};

describe('parseFilterParams', () => {
	it('returns unbounded defaults for an empty query string', () => {
		expect(parseFilterParams(new URLSearchParams())).toEqual(EMPTY);
	});

	it('splits tags and drops empty segments', () => {
		const filters = parseFilterParams(new URLSearchParams('tags=quick,,vegan,'));
		expect(filters.tags).toEqual(['quick', 'vegan']);
	});

	it('splits ingredients and drops empty segments', () => {
		const filters = parseFilterParams(new URLSearchParams('ingredients=olive%20oil,,garlic,'));
		expect(filters.ingredients).toEqual(['olive oil', 'garlic']);
	});

	it('reads numeric ranges', () => {
		const filters = parseFilterParams(
			new URLSearchParams('time_min=10&time_max=45&servings_min=2&servings_max=6')
		);
		expect(filters.timeRange).toEqual({ min: 10, max: 45 });
		expect(filters.servingsRange).toEqual({ min: 2, max: 6 });
	});

	it('treats a non-numeric bound as unset rather than NaN', () => {
		const filters = parseFilterParams(new URLSearchParams('time_max=soon'));
		expect(filters.timeRange.max).toBe(Infinity);
	});
});

describe('buildFilterUrl', () => {
	it('collapses to "/" when nothing is set', () => {
		expect(buildFilterUrl('', EMPTY, 'name', 'asc')).toBe('/');
	});

	it('omits values that equal the default', () => {
		const url = buildFilterUrl('', EMPTY, 'name', 'asc');
		expect(url).not.toContain('sort');
		expect(url).not.toContain('order');
	});

	it('round-trips through parseFilterParams', () => {
		const filters: FilterState = {
			tags: ['quick', 'vegan'],
			ingredients: ['olive oil', 'garlic'],
			course: 'dinner',
			timeRange: { min: 10, max: 45 },
			servingsRange: { min: 2, max: 6 }
		};

		const url = buildFilterUrl('pancakes', filters, 'time', 'desc');
		const parsed = parseFilterParams(new URLSearchParams(url.slice(1)));

		expect(parsed).toEqual(filters);
	});
});

describe('filter drafts', () => {
	it('turns an unbounded maximum into the slider ceiling', () => {
		const draft = parseFilterDraft(new URLSearchParams(''));

		expect(draft.timeRange).toEqual([0, MAX_FILTER_TIME]);
		expect(draft.servingsRange).toEqual([0, MAX_FILTER_SERVINGS]);
		expect(draft.course).toBe('');
	});

	it('round-trips through filterStateFromDraft', () => {
		const filters: FilterState = {
			tags: ['quick'],
			ingredients: ['garlic'],
			course: 'dinner',
			timeRange: { min: 10, max: Infinity },
			servingsRange: { min: 2, max: 6 }
		};

		expect(filterStateFromDraft(parseFilterDraft(buildQuery(filters)))).toEqual(filters);
	});

	it('treats the ceiling as unbounded again', () => {
		const filters = filterStateFromDraft({
			tags: [],
			ingredients: [],
			course: '',
			timeRange: [0, MAX_FILTER_TIME],
			servingsRange: [0, MAX_FILTER_SERVINGS]
		});

		expect(filters).toEqual(EMPTY_FILTER_STATE);
	});
});

describe('buildSortUrl', () => {
	it('keeps search and filters while changing the sort', () => {
		const url = buildSortUrl(new URLSearchParams('q=soup&tags=quick&page=3'), 'time', 'desc');

		expect(url).toBe('?q=soup&tags=quick&sort=time&order=desc');
	});

	it('drops defaults and the page when sorting by name ascending', () => {
		const url = buildSortUrl(
			new URLSearchParams('q=soup&sort=time&order=desc&page=2'),
			'name',
			'asc'
		);

		expect(url).toBe('?q=soup');
	});
});

/** A query string carrying the filters, without the path. */
function buildQuery(filters: FilterState): URLSearchParams {
	return new URLSearchParams(buildFilterUrl('', filters, 'name', 'asc').slice(1));
}
