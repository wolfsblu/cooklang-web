import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import type { MealPlanDay, ResolvedMealPlanEntry } from '#lib/types/meal-plan.js';
import DayColumn from './DayColumn.svelte';

function entry(overrides: Partial<ResolvedMealPlanEntry>): ResolvedMealPlanEntry {
	return {
		slug: 'breakfast/easy-pancakes',
		scale: 1,
		title: 'Easy pancakes',
		servings: 2,
		timeMinutes: 20,
		image: null,
		...overrides
	};
}

function day(entries: ResolvedMealPlanEntry[]): MealPlanDay {
	return {
		date: '2026-11-16',
		weekday: 'Monday',
		weekdayShort: 'Mon',
		dayNumber: '16',
		month: 'Nov',
		label: 'Monday 16 November 2026',
		isToday: false,
		entries
	};
}

describe('DayColumn', () => {
	it('renders every dish in the day and names the column with them', () => {
		const pancakes = entry({ title: 'Pancakes', servings: 2, scale: 2 });
		const salad = entry({
			slug: 'shared/green-salad',
			title: 'Green salad',
			servings: 1,
			scale: 2,
			timeMinutes: null
		});

		render(DayColumn, { props: { day: day([pancakes, salad]) } });

		expect(screen.getByText('Pancakes')).toBeInTheDocument();
		expect(screen.getByText('Green salad')).toBeInTheDocument();

		// "Pancakes" is a recipe for 2 cooked twice; the salad is for 1 twice.
		expect(
			screen.getByRole('region', {
				name: 'Monday: Pancakes, 4 servings; Green salad, 2 servings'
			})
		).toBeInTheDocument();

		expect(screen.getByRole('button', { name: /Pancakes/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Green salad/ })).toBeInTheDocument();
	});

	it('names an empty day and exposes a large add target', async () => {
		const onadd = vi.fn();
		render(DayColumn, { props: { day: day([]), variant: 'phone', onadd } });

		const add = screen.getByRole('button', { name: 'Monday, empty' });
		await fireEvent.click(add);

		expect(onadd).toHaveBeenCalledOnce();
		expect(screen.getByText('Add recipe')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Clear all dishes/ })).toBeNull();
	});

	it('offers a clear action when the day has dishes', () => {
		render(DayColumn, {
			props: { day: day([entry({ title: 'Pancakes' })]), onadd: () => {} }
		});

		expect(
			screen.getByRole('button', { name: 'Clear all dishes from Monday' })
		).toBeInTheDocument();
	});

	it('marks today for assistive technology', () => {
		render(DayColumn, { props: { day: { ...day([]), isToday: true } } });

		expect(screen.getByRole('region', { name: 'Monday, empty' })).toHaveAttribute(
			'aria-current',
			'date'
		);
	});
});
