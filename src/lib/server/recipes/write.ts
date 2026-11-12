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
import path from 'node:path';
import type { RecipeEntry } from './index.js';

/** Raised when the file changed after the editor loaded it. */
export class RecipeConflictError extends Error {
	constructor() {
		super('The recipe changed on disk since it was opened.');
		this.name = 'RecipeConflictError';
	}
}

/** One save at a time. Saves are rare and serialising them avoids temp races. */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
	const run = queue.then(fn, fn);
	queue = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

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

		const temporary = path.join(
			path.dirname(target),
			`.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`
		);

		try {
			await fs.writeFile(temporary, source, {
				encoding: 'utf8',
				// Keep the original permissions; a default-mode temp file renamed
				// into place would quietly change who can edit the library.
				mode: current.mode & 0o777
			});
			await fs.rename(temporary, target);
		} catch (error) {
			await fs.unlink(temporary).catch(() => {});
			throw error;
		}

		return roundedMtime(await fs.stat(target));
	});
}
