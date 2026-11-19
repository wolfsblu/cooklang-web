import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeStoredSelections } from './store';

const known = (slug: string) => ['pancakes', 'soup', 'salad'].includes(slug);

describe('mergeStoredSelections', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('sums a slug already present and adds new ones', () => {
		const result = mergeStoredSelections(
			[
				{ slug: 'pancakes', scale: 2 },
				{ slug: 'soup', scale: 1 }
			],
			[
				{ slug: 'pancakes', scale: 1.5 },
				{ slug: 'salad', scale: 2 }
			],
			known
		);

		expect(result.recipes).toEqual([
			{ slug: 'pancakes', scale: 3.5 },
			{ slug: 'soup', scale: 1 },
			{ slug: 'salad', scale: 2 }
		]);
		expect(result.added).toBe(1);
		expect(result.updated).toBe(1);
	});

	it('aggregates duplicate incoming entries before counting', () => {
		const result = mergeStoredSelections(
			[],
			[
				{ slug: 'salad', scale: 1 },
				{ slug: 'salad', scale: 0.5 }
			],
			known
		);

		expect(result.recipes).toEqual([{ slug: 'salad', scale: 1.5 }]);
		expect(result.added).toBe(1);
		expect(result.updated).toBe(0);
	});

	it('clamps after summing and clamps a nonsensical incoming scale', () => {
		const result = mergeStoredSelections(
			[
				{ slug: 'pancakes', scale: 99.5 },
				{ slug: 'soup', scale: 1 }
			],
			[
				{ slug: 'pancakes', scale: 5 },
				{ slug: 'soup', scale: 0.1 },
				{ slug: 'salad', scale: Number.POSITIVE_INFINITY }
			],
			known
		);

		expect(result.recipes).toEqual([
			{ slug: 'pancakes', scale: 100 },
			{ slug: 'soup', scale: 1.5 },
			{ slug: 'salad', scale: 1 }
		]);
		expect(result.updated).toBe(2);
		expect(result.added).toBe(1);
	});

	it('ignores unknown recipes and does not count them', () => {
		const result = mergeStoredSelections(
			[],
			[
				{ slug: 'pancakes', scale: 1 },
				{ slug: 'deleted', scale: 1 }
			],
			known
		);

		expect(result.recipes).toEqual([{ slug: 'pancakes', scale: 1 }]);
		expect(result.added).toBe(1);
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining('Ignoring unknown recipe "deleted"')
		);
	});

	it('keeps existing entries the index no longer knows', () => {
		const result = mergeStoredSelections(
			[{ slug: 'a-recipe-that-moved', scale: 2 }],
			[{ slug: 'pancakes', scale: 1 }],
			known
		);

		expect(result.recipes).toEqual([
			{ slug: 'a-recipe-that-moved', scale: 2 },
			{ slug: 'pancakes', scale: 1 }
		]);
	});

	it('does not mutate its inputs', () => {
		const existing = [{ slug: 'pancakes', scale: 1 }];
		const incoming = [{ slug: 'pancakes', scale: 1 }];

		mergeStoredSelections(existing, incoming, known);

		expect(existing).toEqual([{ slug: 'pancakes', scale: 1 }]);
		expect(incoming).toEqual([{ slug: 'pancakes', scale: 1 }]);
	});
});
