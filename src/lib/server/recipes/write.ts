/**
 * Recipe source reads and writes.
 *
 * A recipe save is a deliberate, user-visible operation against a NAS share,
 * so it is worth doing carefully: write to a sibling temp file and rename, the
 * same pattern the pantry and aisle stores use. The expected mtime check is
 * optimistic concurrency: if the file was edited elsewhere (on the NAS, by a
 * syncing tool, by another browser tab) the save is refused instead of
 * silently overwriting that work.
 */

import fs from 'node:fs/promises';
import type { RecipeEntry } from './index.js';
import { createLock, writeFileAtomic } from '../storage.js';

/** Raised when the file changed after the editor loaded it. */
export class RecipeConflictError extends Error {
	constructor() {
		super('The recipe changed on disk since it was opened.');
		this.name = 'RecipeConflictError';
	}
}

/** One save at a time. Saves are rare and serialising them avoids temp races. */
const withLock = createLock();

function roundedMtime(stat: { mtimeMs: number }): number {
	return Math.round(stat.mtimeMs);
}

/** Read the recipe, plus the mtime that an edit form should send back. */
export async function readRecipeSource(
	entry: RecipeEntry
): Promise<{ source: string; mtimeMs: number }> {
	const [source, stat] = await Promise.all([
		fs.readFile(entry.absPath, 'utf8'),
		fs.stat(entry.absPath)
	]);

	return { source, mtimeMs: roundedMtime(stat) };
}

/**
 * Replace a recipe's source with `source`.
 *
 * @returns the new mtime, for the editor's next save.
 * @throws {RecipeConflictError} when `expectedMtimeMs` is not the file's mtime.
 */
export async function saveRecipeSource(
	entry: RecipeEntry,
	source: string,
	expectedMtimeMs: number
): Promise<number> {
	return withLock(async () => {
		const target = entry.absPath;
		const current = await fs.stat(target);

		if (roundedMtime(current) !== expectedMtimeMs) {
			throw new RecipeConflictError();
		}

		await writeFileAtomic(target, source, {
			// Keep the original permissions; a default-mode temp file renamed
			// into place would quietly change who can edit the library.
			mode: current.mode & 0o777
		});

		return roundedMtime(await fs.stat(target));
	});
}
