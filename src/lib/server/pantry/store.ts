/**
 * Pantry file access.
 *
 * The pantry lives at <recipes>/config/pantry.conf, which is exactly where the
 * Cook CLI looks for it. Writing there means the CLI subtracts stocked
 * ingredients from generated shopping lists with no further wiring -- verified
 * against cookcli 0.19.3, where `shopping-list` discovers the file and applies
 * it unconditionally.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { createLock, writeFileAtomic } from '../storage.js';
import { parsePantry, serializePantry, type PantryDoc } from './format.js';

const DEFAULT_SECTIONS = ['fridge', 'pantry', 'spices'];

export function pantryPath(): string {
	return path.join(config.RECIPE_PATH, 'config', 'pantry.conf');
}

/**
 * mtime of the pantry file, used as part of the shopping list's cache key so
 * that editing stock invalidates the generated list. Zero when absent.
 */
export async function pantryMtimeMs(): Promise<number> {
	try {
		return Math.round((await fs.stat(pantryPath())).mtimeMs);
	} catch {
		return 0;
	}
}

/** Serializes read-modify-write cycles for this file. */
const withLock = createLock();

/** Read and parse the pantry. Returns an empty document when the file is absent. */
export async function readPantry(): Promise<PantryDoc> {
	try {
		return parsePantry(await fs.readFile(pantryPath(), 'utf8'));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return parsePantry(DEFAULT_SECTIONS.map((section) => `[${section}]`).join('\n\n') + '\n');
		}
		throw error;
	}
}

/** Write the pantry atomically, creating config/ if it does not exist. */
export async function writePantry(doc: PantryDoc): Promise<void> {
	await writeFileAtomic(pantryPath(), serializePantry(doc));
}

/**
 * Read, modify and write under the lock.
 *
 * Every mutation goes through here so two submissions cannot interleave and
 * lose one another's edit.
 */
export async function updatePantry(
	mutate: (doc: PantryDoc) => void | Promise<void>
): Promise<void> {
	await withLock(async () => {
		const doc = await readPantry();
		await mutate(doc);
		await writePantry(doc);
	});
}
