/**
 * English count labels.
 *
 * The templates used to spell this out inline (`count === 1 ? 'recipe' :
 * 'recipes'`), which is easy to get inconsistent and was already wrong for a
 * count of one in a couple of places.
 */

/** The singular or plural noun for `count`, without the number. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return count === 1 ? singular : plural;
}

/** A count and its noun, e.g. "1 recipe" or "3 recipes". */
export function countLabel(count: number, singular: string, plural?: string): string {
	return `${count} ${pluralize(count, singular, plural)}`;
}
