/**
 * Full recipe parsing for the detail page.
 *
 * The index keeps only what the list page needs. Rendering a single recipe
 * needs the whole parse tree turned into display strings, which is expensive
 * enough to be worth caching -- and it is scale-dependent, since cooklang
 * applies scaling during parsing.
 */

import {
	CooklangParser,
	cookware_display_name,
	cookware_should_be_listed,
	grouped_quantity_display,
	grouped_quantity_is_empty,
	ingredient_display_name,
	ingredient_should_be_listed,
	quantity_display,
	type CooklangRecipe
} from '@cooklang/cooklang';
import fs from 'node:fs/promises';
import type { RecipePreview } from '$lib/types/editor.js';
import type { RecipeDisplay } from '$lib/types/recipe.js';
import type { RecipeEntry } from './index.js';
import { diagnosticsFromReport, findEmptyEntity } from './report.js';

/**
 * Cache size. Keyed by slug *and* scale, so a user dragging the servings
 * control generates a new entry per step; the cap stops that from growing
 * without bound.
 */
const CACHE_LIMIT = 64;

/** Insertion-ordered map used as an LRU: re-inserting moves a key to the end. */
const cache = new Map<string, RecipeDisplay>();

/** Clamp scale to a sane range; it arrives from a query parameter. */
export function clampScale(raw: string | null): number {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return 1;
	return Math.min(Math.max(parsed, 0.1), 100);
}

function remember(key: string, value: RecipeDisplay): RecipeDisplay {
	cache.set(key, value);

	if (cache.size > CACHE_LIMIT) {
		const oldest = cache.keys().next();
		if (!oldest.done) cache.delete(oldest.value);
	}

	return value;
}

/**
 * Turn a parsed recipe into the presentational model the components consume.
 *
 * All cooklang helper calls live here so the Svelte components stay
 * presentational. This is shared by the rendered recipe page and the editor's
 * live preview, which must agree on what a step means.
 */
function buildDisplay(recipe: CooklangRecipe, fallbackTitle: string): RecipeDisplay {
	const ingredients = recipe.groupedIngredients
		.filter(([ingredient]) => ingredient_should_be_listed(ingredient))
		.map(([ingredient, quantity], index) => ({
			index,
			name: ingredient_display_name(ingredient),
			quantity: !grouped_quantity_is_empty(quantity) ? grouped_quantity_display(quantity) : null,
			note: ingredient.note
		}));

	const cookware = recipe.groupedCookware
		.filter(([item]) => cookware_should_be_listed(item))
		.map(([item, quantity], index) => ({
			index,
			name: cookware_display_name(item),
			quantity: !grouped_quantity_is_empty(quantity) ? grouped_quantity_display(quantity) : null,
			note: item.note
		}));

	const sections = recipe.sections.map((section) => ({
		name: section.name,
		content: section.content.map((content) => {
			if (content.type === 'text') {
				return { type: 'text' as const, value: content.value };
			}

			return {
				type: 'step' as const,
				number: content.value.number,
				items: content.value.items.map((item) => {
					if (item.type === 'text') {
						return { type: 'text' as const, value: item.value };
					}

					if (item.type === 'ingredient') {
						const ingredient = recipe.ingredients[item.index];
						return {
							type: 'ingredient' as const,
							index: item.index,
							name: ingredient_display_name(ingredient),
							quantity: ingredient.quantity ? quantity_display(ingredient.quantity) : null
						};
					}

					if (item.type === 'cookware') {
						const cookwareItem = recipe.cookware[item.index];
						return {
							type: 'cookware' as const,
							index: item.index,
							name: cookware_display_name(cookwareItem),
							quantity: cookwareItem.quantity ? quantity_display(cookwareItem.quantity) : null
						};
					}

					if (item.type === 'timer') {
						const timer = recipe.timers[item.index];
						return {
							type: 'timer' as const,
							index: item.index,
							name: timer.name,
							quantity: timer.quantity ? quantity_display(timer.quantity) : null
						};
					}

					return {
						type: 'inlineQuantity' as const,
						index: item.index,
						quantity: quantity_display(recipe.inlineQuantities[item.index])
					};
				})
			};
		})
	}));

	const display: RecipeDisplay = {
		title: recipe.title || fallbackTitle,
		description: recipe.description,
		tags: Array.from(recipe.tags ?? []),
		author: recipe.author,
		source: recipe.source,
		course: recipe.course ?? null,
		servings: recipe.servings,
		time: recipe.time,
		ingredients,
		cookware,
		sections
	};

	return display;
}

/**
 * Parse a recipe and pre-compute every display string the client needs.
 *
 * All the cooklang helper calls happen here so the Svelte components stay
 * presentational, which is how the original detail route worked.
 */
export async function getRecipeDisplay(entry: RecipeEntry, scale: number): Promise<RecipeDisplay> {
	// mtime is part of the key, so editing a file invalidates its cached render
	// without anyone having to remember to clear it.
	const key = `${entry.slug}|${entry.mtimeMs}|${scale}`;

	const hit = cache.get(key);
	if (hit) {
		// Refresh recency.
		cache.delete(key);
		return remember(key, hit);
	}

	const source = await fs.readFile(entry.absPath, 'utf8');
	const parser = new CooklangParser();
	const [recipe] = parser.parse(source, scale);

	return remember(key, buildDisplay(recipe, entry.title));
}

/** A parse failure the editor can explain, rather than a WASM panic. */
export class RecipeSourceError extends Error {
	readonly line: number | null;

	constructor(message: string, line: number | null = null) {
		super(message);
		this.name = 'RecipeSourceError';
		this.line = line;
	}
}

/**
 * Parse raw editor text into a preview plus diagnostics.
 *
 * This does not touch disk, so it is cheap enough to run on a debounced
 * keystroke, and it is the same parser and display mapping as the real recipe
 * page. `fallbackTitle` is used until the source declares a title, which keeps
 * the preview from dropping to "Untitled" whenever the title line is being
 * edited.
 */
export function previewRecipe(source: string, fallbackTitle = 'Untitled recipe'): RecipePreview {
	const emptyEntity = findEmptyEntity(source);
	if (emptyEntity) {
		throw new RecipeSourceError(emptyEntity.message, emptyEntity.line);
	}

	const parser = new CooklangParser();
	const [recipe, report] = parser.parse(source);

	return {
		display: buildDisplay(recipe, fallbackTitle),
		diagnostics: diagnosticsFromReport(report)
	};
}

/**
 * A preview to show when the parser itself failed.
 *
 * cooklang-rs panics rather than returning a diagnostic for a few malformed
 * inputs. That must not turn the editor into a 500 or stop a save from being
 * reported as successful, so callers that run during load get this instead.
 */
export function failedPreview(
	fallbackTitle: string,
	message: string,
	line: number | null = null
): RecipePreview {
	return {
		display: {
			title: fallbackTitle,
			tags: [],
			ingredients: [],
			cookware: [],
			sections: []
		},
		diagnostics: [{ severity: 'error', message, line }]
	};
}

/**
 * Drop cached renders for a recipe.
 *
 * Saving twice inside one filesystem timestamp tick can leave the mtime
 * unchanged. The write path calls this so the next render cannot serve the
 * previous text despite the file having changed.
 */
export function invalidateRecipeDisplay(slug: string): void {
	const prefix = `${slug}|`;

	for (const key of cache.keys()) {
		if (key.startsWith(prefix)) cache.delete(key);
	}
}
