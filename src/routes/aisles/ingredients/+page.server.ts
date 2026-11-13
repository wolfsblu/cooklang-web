import type { Actions, PageServerLoad } from './$types';
import type { AisleEntryView } from '$lib/types/aisle.js';
import {
	bulkMove,
	bulkRemove,
	remove,
	resolveDuplicate,
	upsert
} from '$lib/server/aisle/actions.js';
import { findDuplicates } from '$lib/server/aisle/format.js';
import { readAisle } from '$lib/server/aisle/store.js';

export const load: PageServerLoad = async () => {
	const doc = await readAisle();

	const duplicates = findDuplicates(doc);
	// Identify duplicates by category+name rather than object identity: the
	// view model should not depend on findDuplicates returning the very same
	// object references it found.
	const duplicated = new Set(
		duplicates.flatMap((duplicate) =>
			duplicate.entries.map((entry) => `${entry.category}\u0000${entry.name}`)
		)
	);

	return {
		entries: doc.entries.map((entry): AisleEntryView => ({
			...entry,
			duplicate: duplicated.has(`${entry.category}\u0000${entry.name}`)
		})),
		duplicates: duplicates.map((duplicate) => ({
			term: duplicate.term,
			categories: [...new Set(duplicate.entries.map((entry) => entry.category))]
		}))
	};
};

export const actions: Actions = { upsert, remove, bulkMove, bulkRemove, resolveDuplicate };
