/**
 * Shopping list selections, persisted beside the recipes.
 *
 * The file holds slugs and scales only. It used to also copy the title,
 * servings and image URL of each recipe, which went stale as soon as a recipe
 * was edited or renamed; those are re-derived from the index on read.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { RecipeSelection } from '#lib/types/shopping-list.js';
import { config } from '../config.js';
import { getIndex } from '../recipes/index.js';
import { createLock, writeFileAtomic } from '../storage.js';

/** A recipe in the list, as stored. */
export interface StoredSelection {
	slug: string;
	scale: number;
}

/** What a merge did, expressed in distinct recipes. */
export interface MergeResult {
	/** Recipes that were not in the list before. */
	added: number;
	/** Existing recipes whose scale changed. */
	updated: number;
}

interface ShoppingListFileV2 {
	version: 2;
	recipes: StoredSelection[];
}

const FILE_NAME = '.shopping-list.json';

function filePath(): string {
	return path.join(config.RECIPE_PATH, FILE_NAME);
}

/**
 * Serializes read-modify-write cycles for this file.
 *
 * Reads do not take it: writes go through an atomic rename, so a read either
 * sees the old file or the new one, never a partial one.
 */
const withLock = createLock();

function clampScale(value: unknown): number {
	const scale = Number(value);
	if (!Number.isFinite(scale) || scale <= 0) return 1;
	return Math.min(Math.max(scale, 0.5), 100);
}

/**
 * Merge planned recipes into the current selections without losing work.
 *
 * A slug that is already present has its scale added, not replaced: planning
 * the same recipe twice really does mean cooking it twice. Incoming entries
 * are aggregated first, so a week that plans one recipe on two days counts as
 * one added recipe with one final scale.
 *
 * Unknown slugs are ignored rather than written, matching upsertSelection's
 * refusal to store an entry no page can resolve. Existing entries are kept
 * even if the index no longer knows them; this function only adds, and a
 * later read is free to resolve them however it likes.
 *
 * Exported separately from the file-backed wrapper so the arithmetic can be
 * tested without a recipe directory.
 */
export function mergeStoredSelections(
	existing: readonly StoredSelection[],
	incoming: readonly StoredSelection[],
	isKnownSlug: (slug: string) => boolean
): { recipes: StoredSelection[]; added: number; updated: number } {
	const recipes = existing.map((selection) => ({ ...selection }));

	const totals = new Map<string, number>();
	for (const entry of incoming) {
		if (!isKnownSlug(entry.slug)) {
			console.warn(`Ignoring unknown recipe "${entry.slug}" when merging the meal plan`);
			continue;
		}

		totals.set(entry.slug, (totals.get(entry.slug) ?? 0) + clampScale(entry.scale));
	}

	let added = 0;
	let updated = 0;

	for (const [slug, total] of totals) {
		const current = recipes.find((recipe) => recipe.slug === slug);

		if (current) {
			current.scale = clampScale(current.scale + total);
			updated += 1;
		} else {
			recipes.push({ slug, scale: clampScale(total) });
			added += 1;
		}
	}

	return { recipes, added, updated };
}

/**
 * Read the file, migrating older shapes.
 *
 * v1 stored the recipe's filename ("Easy Pancakes.cook") as its slug. Those
 * are matched back to recipes by basename; anything that no longer resolves is
 * dropped rather than left to fail the CLI call later.
 */
async function readFile(): Promise<StoredSelection[]> {
	let raw: string;
	try {
		raw = await fs.readFile(filePath(), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.error('Shopping list file is not valid JSON; treating as empty');
		return [];
	}

	const data = parsed as Partial<ShoppingListFileV2> & { recipes?: unknown };
	if (!Array.isArray(data.recipes)) return [];

	const entries = data.recipes as Array<{ slug?: unknown; scale?: unknown }>;

	if (data.version === 2) {
		return entries
			.filter((entry) => typeof entry.slug === 'string')
			.map((entry) => ({ slug: entry.slug as string, scale: clampScale(entry.scale) }));
	}

	// v1 (or unversioned): slugs were filenames.
	const index = await getIndex();
	const byBasename = new Map(
		index.entries.map((entry) => [path.basename(entry.relPath).toLowerCase(), entry.slug])
	);

	const migrated: StoredSelection[] = [];
	for (const entry of entries) {
		if (typeof entry.slug !== 'string') continue;

		const resolved =
			index.bySlug.get(entry.slug)?.slug ?? byBasename.get(path.basename(entry.slug).toLowerCase());

		if (!resolved) {
			console.warn(`Dropping unknown recipe "${entry.slug}" while migrating the shopping list`);
			continue;
		}

		migrated.push({ slug: resolved, scale: clampScale(entry.scale) });
	}

	return migrated;
}

/** Atomic write: a crash mid-write cannot leave a truncated file behind. */
async function writeFile(recipes: StoredSelection[]): Promise<void> {
	const payload: ShoppingListFileV2 = { version: 2, recipes };
	await writeFileAtomic(filePath(), JSON.stringify(payload, null, 2));
}

/** Selections as stored, without touching the recipe index. */
export async function readSelections(): Promise<StoredSelection[]> {
	return readFile();
}

/** Selections joined against the index. Recipes that no longer exist are omitted. */
export async function resolveSelections(): Promise<RecipeSelection[]> {
	const [stored, index] = await Promise.all([readSelections(), getIndex()]);

	return stored.flatMap((selection) => {
		const entry = index.bySlug.get(selection.slug);
		if (!entry) {
			console.warn(`Shopping list references unknown recipe "${selection.slug}"`);
			return [];
		}

		return [
			{
				...selection,
				title: entry.title,
				relPath: entry.relPath,
				servings: entry.servings
			}
		];
	});
}

/**
 * Add a recipe, or update its scale if already present.
 *
 * @returns false if the slug matches no recipe, in which case nothing is written
 */
export async function upsertSelection(slug: string, scale: number): Promise<boolean> {
	// Validate against the index so a hand-crafted request cannot put an entry
	// in the file that no page can ever resolve or remove.
	const index = await getIndex();
	if (!index.bySlug.has(slug)) return false;

	await withLock(async () => {
		const recipes = await readFile();
		const existing = recipes.find((recipe) => recipe.slug === slug);

		if (existing) existing.scale = clampScale(scale);
		else recipes.push({ slug, scale: clampScale(scale) });

		await writeFile(recipes);
	});

	return true;
}

/**
 * Add every recipe from a planned week, summing scales where they overlap.
 *
 * The read that the counts come from happens under the same lock as the write,
 * so "3 recipes added, 1 updated" describes the file as it actually was when
 * the merge ran, not a stale read from earlier in the request.
 */
export async function mergeSelections(entries: readonly StoredSelection[]): Promise<MergeResult> {
	const index = await getIndex();
	let result: MergeResult = { added: 0, updated: 0 };

	await withLock(async () => {
		const recipes = await readFile();
		const merged = mergeStoredSelections(recipes, entries, (slug) => index.bySlug.has(slug));

		result = { added: merged.added, updated: merged.updated };
		// Nothing valid to merge: do not touch the file at all.
		if (merged.added > 0 || merged.updated > 0) await writeFile(merged.recipes);
	});

	return result;
}

export async function removeSelection(slug: string): Promise<void> {
	await withLock(async () => {
		const recipes = await readFile();
		await writeFile(recipes.filter((recipe) => recipe.slug !== slug));
	});
}

export async function clearSelections(): Promise<void> {
	await withLock(async () => {
		await fs.unlink(filePath()).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== 'ENOENT') throw error;
		});
	});
}
