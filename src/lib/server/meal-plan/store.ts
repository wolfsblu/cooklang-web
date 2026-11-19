/**
 * Weekly meal plan, persisted beside the recipes.
 *
 * The file holds recipe slugs, the day they are planned on and a scale. It
 * deliberately does not hold titles, servings or images: those are re-derived
 * from the recipe index on read, so renaming or editing a recipe cannot leave a
 * stale copy in the plan. This is the same rule the shopping store follows, and
 * for the same reason.
 *
 * Shape (sparse -- only days that actually hold something):
 *
 *   {
 *     "version": 1,
 *     "days": {
 *       "2026-11-16": [{ "slug": "breakfast/easy-pancakes", "scale": 1 }]
 *     }
 *   }
 *
 * A day is one ordered list, not fixed breakfast/lunch/dinner slots. The
 * earlier slot-based shape was replaced before it shipped; a day whose value
 * is an object is now discarded with a warning rather than guessed at.
 *
 * Past weeks are still editable. They are history, but correcting "we actually
 * had that on Tuesday" is useful, and a read-only rule would need a clock in
 * every action. Weeks are not pruned from the file; the file only grows when
 * someone plans another week.
 *
 * There is no day-level note. A note would need a place in this schema and a
 * use beyond repeating the dish titles; the default is no, and it can be added
 * as an optional field without breaking version 1 readers.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ResolvedMealPlanDay, ResolvedMealPlanEntry } from '#lib/types/meal-plan.js';
import { parseISODate, weekDates } from '#lib/utils/week.js';
import { config } from '../config.js';
import { imageRef } from '../images.js';
import { getIndex } from '../recipes/index.js';
import { createLock, writeFileAtomic } from '../storage.js';

/** A recipe on a day, as stored. */
export interface StoredMealPlanEntry {
	slug: string;
	scale: number;
}

export interface StoredMealPlan {
	days: Record<string, StoredMealPlanEntry[]>;
}

interface MealPlanFileV1 {
	version: 1;
	days: Record<string, StoredMealPlanEntry[]>;
}

const FILE_NAME = '.meal-plan.json';

function filePath(): string {
	return path.join(config.RECIPE_PATH, FILE_NAME);
}

/**
 * Serializes read-modify-write cycles for this file.
 *
 * Reads do not take it: writes use an atomic rename, so a reader sees the old
 * file or the new one, never a partial one.
 */
const withLock = createLock();

/** Same range and fallback as the shopping store: 0.5–100, default 1. */
function clampScale(value: unknown): number {
	const scale = Number(value);
	if (!Number.isFinite(scale) || scale <= 0) return 1;
	return Math.min(Math.max(scale, 0.5), 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyPlan(): StoredMealPlan {
	return { days: {} };
}

/**
 * Validate and normalize an already-parsed file.
 *
 * Never throws: one malformed day or entry is dropped with a warning and the
 * rest of the plan survives. Unknown slugs are dropped here rather than left
 * for the page to discover, and the caller supplies the predicate so this can
 * be tested without a recipe directory.
 *
 * `version` may be missing: an unversioned `{ days: ... }` file is treated as
 * version 1 (the migration path for a hand-written plan).
 */
export function parsePlanFile(
	parsed: unknown,
	isKnownSlug: (slug: string) => boolean
): StoredMealPlan {
	if (!isRecord(parsed)) {
		console.warn('Meal plan file is not an object; treating it as empty');
		return emptyPlan();
	}

	if (parsed.version !== undefined && parsed.version !== 1) {
		console.warn(
			`Meal plan file has unsupported version ${String(parsed.version)}; treating it as empty`
		);
		return emptyPlan();
	}

	if (parsed.version === undefined) {
		console.warn('Meal plan file has no version; treating it as version 1');
	}

	const rawDays = parsed.days;
	if (!isRecord(rawDays)) {
		console.warn('Meal plan file has no "days" object; treating it as empty');
		return emptyPlan();
	}

	const days: Record<string, StoredMealPlanEntry[]> = {};

	for (const [rawDate, rawEntries] of Object.entries(rawDays)) {
		const date = parseISODate(rawDate);
		if (!date) {
			console.warn(`Dropping meal plan day "${rawDate}": not an ISO date`);
			continue;
		}

		if (!Array.isArray(rawEntries)) {
			console.warn(`Dropping meal plan day "${rawDate}": not a list of dishes`);
			continue;
		}

		const entries: StoredMealPlanEntry[] = [];

		for (const rawEntry of rawEntries) {
			if (!isRecord(rawEntry) || typeof rawEntry.slug !== 'string') {
				console.warn(`Dropping a malformed entry from meal plan ${date}`);
				continue;
			}

			if (!isKnownSlug(rawEntry.slug)) {
				console.warn(`Dropping unknown recipe "${rawEntry.slug}" from meal plan ${date}`);
				continue;
			}

			entries.push({ slug: rawEntry.slug, scale: clampScale(rawEntry.scale) });
		}

		if (entries.length > 0) days[date] = entries;
	}

	return { days };
}

/** Remove empty days, so the file stays sparse as entries are removed. */
export function prunePlan(plan: StoredMealPlan): StoredMealPlan {
	const days: Record<string, StoredMealPlanEntry[]> = {};

	for (const [date, entries] of Object.entries(plan.days)) {
		if (entries.length > 0) days[date] = entries;
	}

	return { days };
}

async function readFile(): Promise<StoredMealPlan> {
	let raw: string;
	try {
		raw = await fs.readFile(filePath(), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyPlan();
		throw error;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.warn('Meal plan file is not valid JSON; treating it as empty');
		return emptyPlan();
	}

	const index = await getIndex();
	return parsePlanFile(parsed, (slug) => index.bySlug.has(slug));
}

async function writeFile(plan: StoredMealPlan): Promise<void> {
	const payload: MealPlanFileV1 = { version: 1, days: prunePlan(plan).days };
	await writeFileAtomic(filePath(), JSON.stringify(payload, null, 2));
}

/** The whole stored plan, already validated and joined against the index. */
export async function readPlan(): Promise<StoredMealPlan> {
	return readFile();
}

/**
 * Resolve one Monday-to-Sunday week for rendering.
 *
 * A slug can disappear between the parse and this join, so entries whose
 * recipe no longer exists are dropped here too rather than rendered as an
 * untitled row.
 */
export async function resolveWeek(mondayISO: string): Promise<ResolvedMealPlanDay[]> {
	const [plan, index] = await Promise.all([readFile(), getIndex()]);

	return weekDates(mondayISO).map((date) => {
		const entries = (plan.days[date] ?? []).flatMap((entry) => {
			const recipe = index.bySlug.get(entry.slug);
			if (!recipe) {
				console.warn(`Meal plan references unknown recipe "${entry.slug}"`);
				return [];
			}

			return [
				{
					slug: entry.slug,
					scale: entry.scale,
					title: recipe.title,
					servings: recipe.servings,
					timeMinutes: recipe.timeMinutes,
					image: imageRef(recipe.image, 'thumb')
				} satisfies ResolvedMealPlanEntry
			];
		});

		return { date, entries };
	});
}

/** Every stored entry in a week, in day order, for the shopping merge. */
export async function readWeekEntries(mondayISO: string): Promise<StoredMealPlanEntry[]> {
	const plan = await readFile();
	return weekDates(mondayISO).flatMap((date) => plan.days[date] ?? []);
}

/** Append a dish to a day. False when the slug no longer resolves. */
export async function addEntry(day: string, slug: string, scale: number): Promise<boolean> {
	if (!parseISODate(day)) return false;

	// Validate outside the lock: a full index scan should not block a write.
	const index = await getIndex();
	if (!index.bySlug.has(slug)) return false;

	return withLock(async () => {
		const plan = await readFile();
		const entries = (plan.days[day] ??= []);
		entries.push({ slug, scale: clampScale(scale) });
		await writeFile(plan);
		return true;
	});
}

/** Remove the entry at `index` on a day. */
export async function removeEntry(day: string, index: number): Promise<boolean> {
	if (!parseISODate(day)) return false;

	return withLock(async () => {
		const plan = await readFile();
		const entries = plan.days[day];
		if (!entries || index < 0 || index >= entries.length) return false;

		entries.splice(index, 1);
		await writeFile(plan);
		return true;
	});
}

/** Remove every dish from one day. */
export async function clearDay(day: string): Promise<boolean> {
	if (!parseISODate(day)) return false;

	return withLock(async () => {
		const plan = await readFile();
		if (!plan.days[day]) return true;

		delete plan.days[day];
		await writeFile(plan);
		return true;
	});
}

/** Change one dish's scale, clamped to the shopping store's 0.5–100 range. */
export async function setEntryScale(day: string, index: number, scale: number): Promise<boolean> {
	if (!parseISODate(day)) return false;

	return withLock(async () => {
		const plan = await readFile();
		const entry = plan.days[day]?.[index];
		if (!entry) return false;

		entry.scale = clampScale(scale);
		await writeFile(plan);
		return true;
	});
}

/**
 * Move one entry to the end of another day.
 *
 * Dropping a dish on its current day is a no-op: with a flat list the useful
 * move is between days, and reordering within a day is not a feature yet.
 */
export async function moveEntry(fromDay: string, index: number, toDay: string): Promise<boolean> {
	if (!parseISODate(fromDay) || !parseISODate(toDay)) return false;
	// The sheet's day picker starts on the current day; submitting it unchanged
	// should not silently reorder the dish to the end of the same list.
	if (fromDay === toDay) return true;

	return withLock(async () => {
		const plan = await readFile();
		const source = plan.days[fromDay];
		if (!source || index < 0 || index >= source.length) return false;

		const [entry] = source.splice(index, 1);
		const target = (plan.days[toDay] ??= []);
		target.push(entry);

		await writeFile(plan);
		return true;
	});
}
