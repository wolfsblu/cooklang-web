/**
 * The library's ingredient and cookware vocabulary, for editor autocomplete.
 *
 * Names are deduped case-insensitively but the first spelling seen wins. Two
 * spellings that differ only in case are the same ingredient to a cook, and
 * the aisle/shopping matching is exact, so canonicalising silently here would
 * be a lie -- but offering "Flour" and "flour" as separate completions is
 * worse. Whichever spelling the index saw first is the one suggested.
 */

import type { CompletionTerm, EditorVocabulary } from '$lib/types/editor';

interface NameSource {
	ingredientNames: readonly string[];
	cookwareNames?: readonly string[];
}

function addNames(map: Map<string, CompletionTerm>, names: readonly string[]): void {
	for (const rawName of names) {
		const name = rawName.trim();
		if (!name) continue;

		const key = name.toLowerCase();
		const existing = map.get(key);

		if (existing) {
			existing.count++;
		} else {
			map.set(key, { name, count: 1 });
		}
	}
}

function sorted(map: Map<string, CompletionTerm>): CompletionTerm[] {
	return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Build both vocabularies in one pass over the index.
 *
 * The count is the number of recipes using the name, not the number of times
 * it occurs in one recipe. That is the signal worth ranking: an ingredient in
 * forty recipes is more likely to be what someone is reaching for than one
 * used forty times in a single preserve.
 */
export function buildVocabulary(entries: readonly NameSource[]): EditorVocabulary {
	const ingredients = new Map<string, CompletionTerm>();
	const cookware = new Map<string, CompletionTerm>();

	for (const entry of entries) {
		addNames(ingredients, entry.ingredientNames);
		addNames(cookware, entry.cookwareNames ?? []);
	}

	return { ingredients: sorted(ingredients), cookware: sorted(cookware) };
}
