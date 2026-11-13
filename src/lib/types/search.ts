/**
 * Search data as it crosses the server/client boundary.
 *
 * The server ranks and truncates; the client only renders. That keeps the
 * recipe index, pantry and aisle parsers out of the browser bundle, and it
 * means the overlay and the full results page share one response shape.
 */

import type { ImageRef } from './recipe.js';

export type SearchGroupKey = 'recipes' | 'ingredients' | 'aisles' | 'pantry';

/** One result row. */
export interface SearchHit {
	/** Stable across requests, used for keyboard selection and keyed rendering. */
	id: string;
	group: SearchGroupKey;
	title: string;
	/** Secondary context, e.g. "In fruit and veg · also called aubergine". */
	subtitle: string | null;
	href: string;
	/** Recipe thumbnail, when the hit is a recipe with artwork. */
	image: ImageRef | null;
	/** Small trailing labels, e.g. "25 min" or "not in stock". */
	meta: string[];
}

export interface SearchGroup {
	key: SearchGroupKey;
	label: string;
	hits: SearchHit[];
	/** Total matches in this group before truncation. */
	total: number;
}

export interface SearchResponse {
	query: string;
	/** Total matches across all groups. */
	total: number;
	groups: SearchGroup[];
	/** Size of each corpus, for the empty state and browse cards. */
	counts: Record<SearchGroupKey, number>;
	/** Server-side ranking time, shown in the results footer. */
	tookMs: number;
}
