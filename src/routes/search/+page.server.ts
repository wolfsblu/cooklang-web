import type { PageServerLoad } from './$types.js';
import { searchEverything } from '$lib/server/search.js';

/** Long enough for a sentence, matching the API route's limit. */
const MAX_QUERY_LENGTH = 200;

/**
 * The full results page.
 *
 * It calls the same search function as `/api/search`, so a query typed into
 * the page and the same query typed into the overlay return identical groups.
 * The page asks for a much larger per-group limit: it is the "see all" view.
 */
export const load: PageServerLoad = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
	const results = await searchEverything(query, { perGroup: 50 });

	return { ...results };
};
