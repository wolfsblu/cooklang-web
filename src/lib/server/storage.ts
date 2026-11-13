/**
 * Filesystem primitives shared by the on-disk stores.
 *
 * The pantry, aisle, shopping-list and recipe stores all read, modify and write
 * a file the same way. They used to each carry their own copy of the mutex and
 * the write-temp-then-rename dance, which meant four places to get the subtle
 * parts wrong.
 *
 * Reads deliberately do not take the lock. Every write lands through an atomic
 * rename, so a reader sees either the whole old file or the whole new one, and
 * serialising reads behind writes would put a mutex in front of every page
 * load.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * A mutex that serialises read-modify-write cycles for one file.
 *
 * Each store gets its own lock rather than sharing a global one: writes to
 * unrelated files can proceed in parallel, while two edits of the same file
 * cannot interleave and lose one another's change.
 */
export function createLock(): <T>(fn: () => Promise<T>) => Promise<T> {
	let queue: Promise<unknown> = Promise.resolve();

	return <T>(fn: () => Promise<T>): Promise<T> => {
		// `queue.then(fn, fn)` runs `fn` whether the previous operation resolved
		// or rejected, so one failed write never wedges the store.
		const run = queue.then(fn, fn);
		queue = run.then(
			() => undefined,
			() => undefined
		);
		return run;
	};
}

export interface AtomicWriteOptions {
	/** Permission bits for the new file; omitted means the process default. */
	mode?: number;
}

/**
 * Replace a file atomically: write a sibling temp file, then rename it over
 * the target.
 *
 * A rename within one directory is atomic, so a crash mid-write cannot leave a
 * truncated file behind and a concurrent reader never observes a partial one.
 */
export async function writeFileAtomic(
	target: string,
	contents: string | Uint8Array,
	options: AtomicWriteOptions = {}
): Promise<void> {
	const directory = path.dirname(target);
	// The random suffix keeps two writers that ignored the lock from unlinking
	// each other's temp file during cleanup.
	const temporary = path.join(
		directory,
		`.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`
	);

	await fs.mkdir(directory, { recursive: true });

	try {
		await fs.writeFile(temporary, contents, {
			encoding: 'utf8',
			...(options.mode !== undefined ? { mode: options.mode } : {})
		});
		await fs.rename(temporary, target);
	} catch (error) {
		await fs.unlink(temporary).catch(() => {});
		throw error;
	}
}
