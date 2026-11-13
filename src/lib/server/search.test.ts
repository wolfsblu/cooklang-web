import { describe, expect, it } from 'vitest';
import type { RecipeEntry } from './recipes/index';
import { parseAisle } from './aisle/format';
import { parsePantry } from './pantry/format';
import { searchCatalog, type SearchCatalog } from './search';

function recipe(title: string, overrides: Partial<RecipeEntry> = {}): RecipeEntry {
	const ingredients = overrides.ingredientNames ?? [];
	const tags = overrides.tags ?? [];

	return {
		slug: title.toLowerCase().replace(/\s+/g, '-'),
		relPath: `${title}.cook`,
		absPath: `/recipes/${title}.cook`,
		title,
		description: null,
		tags,
		course: null,
		servings: null,
		timeMinutes: null,
		image: null,
		stepImages: {},
		mtimeMs: 0,
		size: 0,
		ingredientNames: ingredients,
		cookwareNames: [],
		searchable: {
			title: title.toLowerCase(),
			tags: tags.join(' ').toLowerCase(),
			ingredients: ingredients.join(' ').toLowerCase(),
			body: `${title} ${ingredients.join(' ')}`.toLowerCase()
		},
		...overrides
	};
}

function catalog(overrides: Partial<SearchCatalog> = {}): SearchCatalog {
	return {
		recipes: [],
		aisle: parseAisle('[dairy]\nmilk | whole milk\nbutter\n\n[fruit and veg]\nonion | onions\n'),
		pantry: parsePantry('[fridge]\nmilk = "2%l"\n# yoghurt = "1%l"\n'),
		...overrides
	};
}

describe('searchCatalog', () => {
	it('returns groups in a stable, deliberate order', () => {
		const result = searchCatalog(
			catalog({ recipes: [recipe('Milk cake', { ingredientNames: ['milk'] })] }),
			'milk'
		);

		expect(result.groups.map((group) => group.key)).toEqual([
			'recipes',
			'ingredients',
			'pantry',
			'aisles'
		]);
	});

	it('counts every match but truncates the hits', () => {
		const recipes = Array.from({ length: 8 }, (_, index) => recipe(`Milk recipe ${index}`));
		const result = searchCatalog(catalog({ recipes }), 'milk', { perGroup: 3 });

		expect(result.groups[0].hits).toHaveLength(3);
		expect(result.groups[0].total).toBe(8);
		expect(result.total).toBeGreaterThanOrEqual(8);
	});

	it('ranks a title match above a body-only match', () => {
		const result = searchCatalog(
			catalog({
				recipes: [recipe('Weeknight dinner', { ingredientNames: ['lemon'] }), recipe('Lemon tart')]
			}),
			'lemon'
		);

		expect(result.groups[0].hits.map((hit) => hit.title)).toEqual([
			'Lemon tart',
			'Weeknight dinner'
		]);
	});

	it('requires every query term to match', () => {
		const result = searchCatalog(
			catalog({
				recipes: [recipe('Lemon chicken'), recipe('Lemon tart')]
			}),
			'lemon chicken'
		);

		expect(result.groups[0].hits.map((hit) => hit.title)).toEqual(['Lemon chicken']);
	});

	it('finds ingredients by an alias and links to their aisle', () => {
		const result = searchCatalog(catalog(), 'whole milk');
		const ingredients = result.groups.find((group) => group.key === 'ingredients');

		expect(ingredients?.hits[0]).toMatchObject({
			title: 'milk',
			href: '/aisles/ingredients?category=dairy'
		});
		expect(ingredients?.hits[0].subtitle).toContain('whole milk');
	});

	it('finds an aisle by an ingredient that lives in it', () => {
		const result = searchCatalog(catalog(), 'onion');
		const aisles = result.groups.find((group) => group.key === 'aisles');

		expect(aisles?.hits[0]).toMatchObject({
			title: 'fruit and veg',
			href: '/aisles/ingredients?category=fruit%20and%20veg'
		});
	});

	it('finds pantry stock, including items that are remembered but not stocked', () => {
		const result = searchCatalog(catalog(), 'yoghurt');
		const pantry = result.groups.find((group) => group.key === 'pantry');

		expect(pantry?.hits[0]).toMatchObject({
			title: 'yoghurt',
			href: '/pantry?folder=fridge',
			subtitle: 'fridge · not in stock'
		});
	});

	it('returns corpus sizes for the browse state', () => {
		const result = searchCatalog(catalog({ recipes: [recipe('Soup')] }), '');

		expect(result.groups).toEqual([]);
		expect(result.total).toBe(0);
		expect(result.counts).toEqual({
			recipes: 1,
			ingredients: 3,
			aisles: 2,
			pantry: 2
		});
	});
});
