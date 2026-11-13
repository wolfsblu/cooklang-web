/**
 * Unified search across the four things this app knows about: recipes,
 * ingredients (aisle entries), aisles themselves, and pantry stock.
 *
 * Ranking happens here rather than in the browser because the corpora live on
 * the server: the recipe index is an in-memory parse of the library, and the
 * aisle and pantry files are plain config. Fetching a small grouped response
 * per keystroke is cheaper than shipping all of it to the client -- and it
 * means a recipe that was just edited is searchable without a rebuild.
 *
 * The shape deliberately mirrors a hosted search API: groups, totals and
 * truncation. The overlay and the full results page are two presentations of
 * the same response.
 */

import { readPantry } from './pantry/store.js';
import { formatQuantity } from './pantry/quantity.js';
import { readAisle } from './aisle/store.js';
import { getIndex, type RecipeEntry } from './recipes/index.js';
import type { AisleDoc } from './aisle/format.js';
import type { PantryDoc } from './pantry/format.js';
import type { SearchGroup, SearchGroupKey, SearchHit, SearchResponse } from '$lib/types/search.js';
import { imageRef } from './images.js';
import { rankFields, type SearchField } from '$lib/utils/search-match.js';
import { countLabel } from '$lib/utils/pluralize.js';

/** How many hits the inline overlay shows per group. The page asks for more. */
export const DEFAULT_GROUP_LIMIT = 5;

export interface SearchOptions {
	/** Maximum hits returned per group. Totals still count every match. */
	perGroup?: number;
}

export interface SearchCatalog {
	recipes: readonly RecipeEntry[];
	aisle: AisleDoc;
	pantry: PantryDoc;
}

interface ScoredHit {
	hit: SearchHit;
	score: number;
}

/** Sort by score, then alphabetically so ties do not shuffle between requests. */
function rank(scored: ScoredHit[]): SearchHit[] {
	return scored
		.sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title))
		.map((entry) => entry.hit);
}

function group(key: SearchGroupKey, label: string, hits: SearchHit[], limit: number): SearchGroup {
	return {
		key,
		label,
		hits: hits.slice(0, limit),
		total: hits.length
	};
}

function recipeFields(entry: RecipeEntry): SearchField[] {
	return [
		{ text: entry.title, weight: 10, fuzzy: true },
		{ text: entry.description ?? '', weight: 3 },
		{ text: entry.tags.join(' '), weight: 6, fuzzy: true },
		{ text: entry.ingredientNames.join(' '), weight: 4, fuzzy: true },
		// The body is prose and source: literal only, so a query does not
		// fuzzy-match unrelated words across a whole recipe.
		{ text: entry.searchable.body, weight: 1 }
	];
}

function searchRecipes(recipes: readonly RecipeEntry[], query: string): SearchHit[] {
	const scored: ScoredHit[] = [];

	for (const entry of recipes) {
		const score = rankFields(recipeFields(entry), query);
		if (score === 0) continue;

		const subtitle =
			entry.description?.trim() ||
			(entry.tags.length > 0 ? entry.tags.slice(0, 4).join(' · ') : null);

		const meta = [
			entry.timeMinutes ? `${entry.timeMinutes} min` : null,
			entry.servings ? `${entry.servings} servings` : null
		].filter((value): value is string => value !== null);

		scored.push({
			score,
			hit: {
				id: `recipe:${entry.slug}`,
				group: 'recipes',
				title: entry.title,
				subtitle,
				href: `/recipe/${entry.slug}`,
				image: imageRef(entry.image, 'thumb'),
				meta
			}
		});
	}

	return rank(scored);
}

function searchIngredients(aisle: AisleDoc, query: string): SearchHit[] {
	const scored: ScoredHit[] = [];

	for (const entry of aisle.entries) {
		const score = rankFields(
			[
				{ text: entry.name, weight: 10, fuzzy: true },
				{ text: entry.aliases.join(' '), weight: 7, fuzzy: true }
			],
			query
		);
		if (score === 0) continue;

		const subtitle = [
			entry.category ? `In ${entry.category}` : null,
			entry.aliases.length > 0 ? `also ${entry.aliases.slice(0, 3).join(', ')}` : null
		]
			.filter(Boolean)
			.join(' · ');

		scored.push({
			score,
			hit: {
				id: `ingredient:${entry.category}:${entry.name}`,
				group: 'ingredients',
				title: entry.name,
				subtitle: subtitle || null,
				href: `/aisles/ingredients?category=${encodeURIComponent(entry.category)}`,
				image: null,
				meta: []
			}
		});
	}

	return rank(scored);
}

function searchAisles(aisle: AisleDoc, query: string): SearchHit[] {
	const scored: ScoredHit[] = [];

	for (const category of aisle.categories) {
		const members = aisle.entries.filter((entry) => entry.category === category);
		const vocabulary = members.flatMap((entry) => [entry.name, ...entry.aliases]);

		const score = rankFields(
			[
				{ text: category, weight: 10, fuzzy: true },
				// An aisle is also findable by what lives in it: "milk" should
				// suggest dairy even if the aisle name is not the obvious one.
				{ text: vocabulary.join(' '), weight: 1 }
			],
			query
		);
		if (score === 0) continue;

		const sample = members.slice(0, 4).map((entry) => entry.name);
		const subtitle =
			members.length === 0
				? 'Empty aisle'
				: [countLabel(members.length, 'ingredient'), sample.join(', ')].join(' · ') +
					(members.length > sample.length ? '…' : '');

		scored.push({
			score,
			hit: {
				id: `aisle:${category}`,
				group: 'aisles',
				title: category,
				subtitle,
				href: `/aisles/ingredients?category=${encodeURIComponent(category)}`,
				image: null,
				meta: []
			}
		});
	}

	return rank(scored);
}

function searchPantry(pantry: PantryDoc, query: string): SearchHit[] {
	const scored: ScoredHit[] = [];

	for (const item of pantry.items) {
		const score = rankFields(
			[
				{ text: item.name, weight: 10, fuzzy: true },
				{ text: item.section, weight: 4 }
			],
			query
		);
		if (score === 0) continue;

		const quantity = item.disabled ? null : formatQuantity(item.quantity);
		const subtitle = [item.section, quantity, item.disabled ? 'not in stock' : null]
			.filter(Boolean)
			.join(' · ');

		scored.push({
			score,
			hit: {
				id: `pantry:${item.section}:${item.name}`,
				group: 'pantry',
				title: item.name,
				subtitle: subtitle || null,
				href: `/pantry?folder=${encodeURIComponent(item.section)}`,
				image: null,
				meta: []
			}
		});
	}

	return rank(scored);
}

/**
 * Search an already-loaded catalog.
 *
 * Split out from the loader so ranking and truncation can be tested without a
 * recipe directory, a pantry file or a network mount.
 */
export function searchCatalog(
	catalog: SearchCatalog,
	query: string,
	options: SearchOptions = {}
): SearchResponse {
	const started = performance.now();
	const trimmed = query.trim();
	const limit = Math.max(1, options.perGroup ?? DEFAULT_GROUP_LIMIT);

	const counts: Record<SearchGroupKey, number> = {
		recipes: catalog.recipes.length,
		ingredients: catalog.aisle.entries.length,
		aisles: catalog.aisle.categories.length,
		pantry: catalog.pantry.items.length
	};

	// An empty query is the browse state, not a search that matches everything:
	// returning the whole library would make the overlay open with hundreds of
	// rows behind an empty input.
	if (trimmed.length === 0) {
		return {
			query: '',
			total: 0,
			groups: [],
			counts,
			tookMs: Math.round((performance.now() - started) * 10) / 10
		};
	}

	const groups = [
		group('recipes', 'Recipes', searchRecipes(catalog.recipes, trimmed), limit),
		group('ingredients', 'Ingredients', searchIngredients(catalog.aisle, trimmed), limit),
		group('pantry', 'Pantry', searchPantry(catalog.pantry, trimmed), limit),
		group('aisles', 'Aisles', searchAisles(catalog.aisle, trimmed), limit)
	].filter((result) => result.total > 0);

	return {
		query: trimmed,
		total: groups.reduce((sum, result) => sum + result.total, 0),
		groups,
		counts,
		tookMs: Math.round((performance.now() - started) * 10) / 10
	};
}

/**
 * Load every corpus and search it.
 *
 * The reads are cheap relative to the request: the recipe index is cached by
 * mtime, and the aisle and pantry files are small. Running them concurrently
 * keeps a keystroke bounded by the slowest one.
 */
export async function searchEverything(
	query: string,
	options: SearchOptions = {}
): Promise<SearchResponse> {
	const [index, aisle, pantry] = await Promise.all([getIndex(), readAisle(), readPantry()]);

	return searchCatalog({ recipes: index.entries, aisle, pantry }, query, options);
}
