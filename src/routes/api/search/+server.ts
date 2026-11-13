/**
 * JSON search for the command-palette overlay.
 *
 * The full results page calls the same `searchEverything` function from its
 * load function, so the two presentations cannot drift. This route exists only
 * because the overlay searches on every keystroke, which is not a navigation.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { searchEverything, DEFAULT_GROUP_LIMIT } from '$lib/server/search.js';

/** Long enough for a sentence, short enough not to rank against a novel. */
const MAX_QUERY_LENGTH = 200;

/** The overlay never needs more than a handful per group. */
const MAX_PER_GROUP = 20;

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);

	const requested = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
	const perGroup = Number.isFinite(requested)
		? Math.min(Math.max(requested, 1), MAX_PER_GROUP)
		: DEFAULT_GROUP_LIMIT;

	const response = await searchEverything(query, { perGroup });

	return json(response, {
		// Results depend on files that can change between keystrokes.
		headers: { 'cache-control': 'no-store' }
	});
};
