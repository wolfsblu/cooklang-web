/**
 * Meal plan data as it crosses the server/client boundary.
 *
 * The persisted file holds slugs and scales only (see
 * $lib/server/meal-plan/store.ts). Titles, servings and images are joined
 * against the recipe index on read, exactly like the shopping list, so a
 * renamed or edited recipe never leaves stale metadata in the plan.
 *
 * A day is one ordered list rather than fixed breakfast/lunch/dinner slots:
 * the product decision is that a day's cooking is not reliably divided into
 * named meals, and a day can be a main plus a side. The order is the order the
 * dishes were added, and every dish can be scaled on its own.
 */

import type { ImageRef } from './recipe.js';

/** The stored shape of one dish: a recipe slug and how many times to cook it. */
export interface MealPlanEntryRef {
	slug: string;
	scale: number;
}

/** A dish after its slug has been joined against the recipe index. */
export interface ResolvedMealPlanEntry extends MealPlanEntryRef {
	title: string;
	/** What the recipe file declares, before the entry's scale is applied. */
	servings: number | null;
	timeMinutes: number | null;
	image: ImageRef | null;
}

/** One day of a resolved week, before display labels are added. */
export interface ResolvedMealPlanDay {
	/** ISO date at UTC midnight, e.g. "2026-11-16". */
	date: string;
	entries: ResolvedMealPlanEntry[];
}

/**
 * A day as rendered.
 *
 * Every label is computed on the server. Formatting dates in the component
 * would risk a different default locale in the browser and on the server,
 * which is a hydration mismatch even when the date itself is correct.
 */
export interface MealPlanDay extends ResolvedMealPlanDay {
	/** "Monday". */
	weekday: string;
	/** "Mon". */
	weekdayShort: string;
	/** "16". */
	dayNumber: string;
	/** "Nov". */
	month: string;
	/** "Monday 16 November 2026". */
	label: string;
	isToday: boolean;
}

export interface MealPlanSummary {
	/** Days with at least one dish. */
	days: number;
	/** Distinct recipe slugs across the week. */
	recipes: number;
	/** Rounded base servings × scale, ignoring recipes that declare none. */
	servings: number;
	/** Individual dishes, in case a day holds a main and a side. */
	dishes: number;
}

/** The small recipe shape the picker needs before it posts an add form. */
export interface MealPlanRecipeOption {
	slug: string;
	title: string;
	servings: number | null;
	timeMinutes: number | null;
	image: ImageRef | null;
}
