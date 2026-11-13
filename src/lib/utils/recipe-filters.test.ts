import { describe, expect, it } from 'vitest';
import { applyFilters, type FilterState, type FilterableRecipe } from './recipe-filters';

const NO_FILTERS: FilterState = {
	tags: [],
	ingredients: [],
	course: null,
	timeRange: { min: 0, max: Infinity },
	servingsRange: { min: 0, max: Infinity }
};

function recipe(
	ingredients: string[],
	overrides: Partial<FilterableRecipe> = {}
): FilterableRecipe {
	return {
		title: 'Recipe',
		tags: [],
		course: null,
		servings: null,
		timeMinutes: null,
		ingredientNames: ingredients,
		...overrides
	};
}

describe('applyFilters with ingredients', () => {
	it('keeps recipes listing every selected ingredient', () => {
		const recipes = [
			recipe(['olive oil', 'garlic']),
			recipe(['olive oil']),
			recipe(['garlic', 'chilli'])
		];

		const filtered = applyFilters(recipes, { ...NO_FILTERS, ingredients: ['olive oil', 'garlic'] });

		expect(filtered).toEqual([recipes[0]]);
	});

	it('compares names without regard to case', () => {
		const recipes = [recipe(['Olive Oil', 'Salt'])];

		const filtered = applyFilters(recipes, { ...NO_FILTERS, ingredients: ['olive oil', 'salt'] });

		expect(filtered).toEqual(recipes);
	});

	it('treats a recipe without an ingredient list as having none', () => {
		const card: FilterableRecipe = {
			title: 'Projected card',
			tags: [],
			course: null,
			servings: null,
			timeMinutes: null
		};

		expect(applyFilters([card], { ...NO_FILTERS, ingredients: ['salt'] })).toEqual([]);
	});
});
