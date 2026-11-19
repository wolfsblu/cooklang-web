import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { MealPlanDay, MealPlanRecipeOption, MealPlanSummary } from '#lib/types/meal-plan.js';
import { imageRef } from '#lib/server/images.js';
import {
	addEntry,
	clearDay as clearDayEntries,
	moveEntry,
	readWeekEntries,
	removeEntry,
	resolveWeek,
	setEntryScale
} from '#lib/server/meal-plan/store.js';
import { getIndex } from '#lib/server/recipes/index.js';
import { mergeSelections, type MergeResult } from '#lib/server/shopping/store.js';
import { countLabel } from '#lib/utils/pluralize.js';
import {
	addDays,
	dayInfo,
	formatWeekRange,
	parseISODate,
	startOfWeek,
	toISODate
} from '#lib/utils/week.js';

function summarize(days: readonly MealPlanDay[]): MealPlanSummary {
	const recipes = new Set<string>();
	let plannedDays = 0;
	let dishes = 0;
	let servings = 0;

	for (const day of days) {
		if (day.entries.length > 0) plannedDays += 1;

		for (const entry of day.entries) {
			dishes += 1;
			recipes.add(entry.slug);
			if (entry.servings !== null) {
				servings += Math.round(entry.servings * entry.scale);
			}
		}
	}

	return { days: plannedDays, recipes: recipes.size, servings, dishes };
}

/**
 * The week is a URL: `?start=YYYY-MM-DD`. An absent or invalid value falls back
 * to the week containing the server's today, so the page is bookmarkable and
 * correct on first paint.
 *
 * "Today" comes from here rather than from `new Date()` during render, so the
 * today marker cannot disagree between SSR and hydration.
 */
export const load: PageServerLoad = async ({ url }) => {
	const today = toISODate(new Date());
	const requested = parseISODate(url.searchParams.get('start'));
	const start = startOfWeek(requested ?? today);

	const [resolved, index] = await Promise.all([resolveWeek(start), getIndex()]);

	const days: MealPlanDay[] = resolved.map((day) => ({
		...day,
		...dayInfo(day.date),
		isToday: day.date === today
	}));

	// Something to show before the picker has a query, and a no-JS path to the
	// add forms. The search API takes over as soon as the user types.
	const suggestions: MealPlanRecipeOption[] = [...index.entries]
		.sort((a, b) => a.title.localeCompare(b.title))
		.slice(0, 12)
		.map((entry) => ({
			slug: entry.slug,
			title: entry.title,
			servings: entry.servings,
			timeMinutes: entry.timeMinutes,
			image: imageRef(entry.image, 'thumb')
		}));

	return {
		today,
		start,
		end: addDays(start, 6),
		isCurrentWeek: start === startOfWeek(today),
		previousWeek: addDays(start, -7),
		nextWeek: addDays(start, 7),
		weekLabel: formatWeekRange(start),
		days,
		summary: summarize(days),
		suggestions
	};
};

function readSlug(data: FormData): string | null {
	const slug = data.get('slug');
	return typeof slug === 'string' && slug.length > 0 ? slug : null;
}

function readDay(data: FormData, field = 'day'): string | null {
	const raw = data.get(field);
	return typeof raw === 'string' ? parseISODate(raw) : null;
}

function readIndex(data: FormData, field = 'index'): number | null {
	const index = Number(data.get(field));
	return Number.isInteger(index) && index >= 0 ? index : null;
}

/** Mirrors the shopping page: anything nonsensical becomes 1, then clamps. */
function readScale(data: FormData): number {
	const scale = Number(data.get('scale'));
	return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function describeMerge(result: MergeResult): string {
	if (result.added === 0 && result.updated === 0) {
		return 'No recipes to add from this week.';
	}

	const parts: string[] = [];
	if (result.added > 0) parts.push(`${countLabel(result.added, 'recipe')} added`);
	if (result.updated > 0) parts.push(`${result.updated} updated`);

	return parts.join(', ');
}

/**
 * Form actions rather than a client store.
 *
 * The shopping store's module-level $state was removed because on the server it
 * is shared by every SSR request. The meal plan has the same constraint, so
 * every mutation is a POST and every read comes from `load`.
 */
export const actions: Actions = {
	add: async ({ request }) => {
		const data = await request.formData();
		const day = readDay(data);
		const slug = readSlug(data);

		if (!day) return fail(400, { error: 'Choose a valid day.' });
		if (!slug) return fail(400, { error: 'Choose a recipe.' });

		if (!(await addEntry(day, slug, readScale(data)))) {
			return fail(404, { error: `No recipe named "${slug}"` });
		}

		return { ok: true, message: null, merge: null };
	},

	remove: async ({ request }) => {
		const data = await request.formData();
		const day = readDay(data);
		const index = readIndex(data);

		if (!day || index === null) {
			return fail(400, { error: 'That dish could not be identified.' });
		}

		if (!(await removeEntry(day, index))) {
			return fail(404, { error: 'That dish is no longer in the plan.' });
		}

		return { ok: true, message: null, merge: null };
	},

	setScale: async ({ request }) => {
		const data = await request.formData();
		const day = readDay(data);
		const index = readIndex(data);

		if (!day || index === null) {
			return fail(400, { error: 'That dish could not be identified.' });
		}

		if (!(await setEntryScale(day, index, readScale(data)))) {
			return fail(404, { error: 'That dish is no longer in the plan.' });
		}

		return { ok: true, message: null, merge: null };
	},

	move: async ({ request }) => {
		const data = await request.formData();
		const fromDay = readDay(data, 'fromDay');
		const index = readIndex(data);
		const toDay = readDay(data, 'toDay');

		if (!fromDay || index === null || !toDay) {
			return fail(400, { error: 'Choose where to move that dish.' });
		}

		if (!(await moveEntry(fromDay, index, toDay))) {
			return fail(404, { error: 'That dish is no longer in the plan.' });
		}

		return { ok: true, message: null, merge: null };
	},

	clearDay: async ({ request }) => {
		const data = await request.formData();
		const day = readDay(data);

		if (!day) return fail(400, { error: 'Choose a valid day.' });

		await clearDayEntries(day);
		return { ok: true, message: null, merge: null };
	},

	addToShopping: async ({ request }) => {
		const data = await request.formData();
		const slug = readSlug(data);

		if (!slug) return fail(400, { error: 'Choose a recipe.' });

		const result = await mergeSelections([{ slug, scale: readScale(data) }]);
		if (result.added === 0 && result.updated === 0) {
			return fail(404, { error: `No recipe named "${slug}"` });
		}

		return { ok: true, message: null, merge: result };
	},

	addWeek: async ({ request }) => {
		const data = await request.formData();
		const requested = parseISODate(
			typeof data.get('start') === 'string' ? (data.get('start') as string) : null
		);
		if (!requested) return fail(400, { error: 'Choose a valid week.' });

		const start = startOfWeek(requested);
		const entries = await readWeekEntries(start);

		if (entries.length === 0) {
			return {
				ok: true,
				message: 'Nothing is planned for this week yet.',
				merge: { added: 0, updated: 0 } satisfies MergeResult
			};
		}

		// Merge duplicates before handing them to the store. The store also
		// aggregates, but doing it here keeps the count in the message honest:
		// one recipe planned twice is one add, not two.
		const merged = new Map<string, number>();
		for (const entry of entries) {
			merged.set(entry.slug, (merged.get(entry.slug) ?? 0) + entry.scale);
		}

		const result = await mergeSelections([...merged].map(([slug, scale]) => ({ slug, scale })));

		return { ok: true, message: describeMerge(result), merge: result };
	}
};
