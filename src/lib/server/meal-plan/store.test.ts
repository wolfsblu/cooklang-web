import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePlanFile, prunePlan } from './store';

const known = (slug: string) => slug === 'breakfast/easy-pancakes' || slug === 'shared/guacamole';

describe('parsePlanFile', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reads a sparse version 1 plan and preserves dish order', () => {
		const plan = parsePlanFile(
			{
				version: 1,
				days: {
					'2026-11-16': [
						{ slug: 'breakfast/easy-pancakes', scale: 2 },
						{ slug: 'shared/guacamole', scale: 1 }
					]
				}
			},
			known
		);

		expect(plan.days['2026-11-16'].map((entry) => entry.slug)).toEqual([
			'breakfast/easy-pancakes',
			'shared/guacamole'
		]);
		expect(plan.days['2026-11-17']).toBeUndefined();
	});

	it('treats an unversioned file as version 1', () => {
		const plan = parsePlanFile(
			{ days: { '2026-11-16': [{ slug: 'shared/guacamole', scale: 1 }] } },
			known
		);

		expect(plan.days['2026-11-16']).toHaveLength(1);
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no version'));
	});

	it('ignores an unsupported future version instead of guessing', () => {
		expect(parsePlanFile({ version: 99, days: {} }, known)).toEqual({ days: {} });
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('unsupported version'));
	});

	it('drops malformed days and entries but keeps the valid ones', () => {
		const plan = parsePlanFile(
			{
				version: 1,
				days: {
					'not-a-date': [{ slug: 'breakfast/easy-pancakes', scale: 1 }],
					'2026-11-16': [{ slug: 'shared/guacamole', scale: 1 }, 'not an object', { scale: 2 }],
					'2026-11-17': { entries: [{ slug: 'breakfast/easy-pancakes', scale: 1 }] },
					'2026-02-30': [{ slug: 'breakfast/easy-pancakes', scale: 1 }]
				}
			},
			known
		);

		expect(Object.keys(plan.days)).toEqual(['2026-11-16']);
		expect(plan.days['2026-11-16']).toEqual([{ slug: 'shared/guacamole', scale: 1 }]);
	});

	it('drops recipes that are no longer in the index', () => {
		const plan = parsePlanFile(
			{
				version: 1,
				days: {
					'2026-11-16': [
						{ slug: 'breakfast/easy-pancakes', scale: 1 },
						{ slug: 'deleted/recipe', scale: 1 }
					]
				}
			},
			known
		);

		expect(plan.days['2026-11-16']).toEqual([{ slug: 'breakfast/easy-pancakes', scale: 1 }]);
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining('Dropping unknown recipe "deleted/recipe"')
		);
	});

	it('clamps scales exactly like the shopping store', () => {
		const plan = parsePlanFile(
			{
				version: 1,
				days: {
					'2026-11-16': [
						{ slug: 'breakfast/easy-pancakes', scale: 0.1 },
						{ slug: 'shared/guacamole', scale: 1000 },
						{ slug: 'breakfast/easy-pancakes', scale: -3 }
					]
				}
			},
			known
		);

		expect(plan.days['2026-11-16'].map((entry) => entry.scale)).toEqual([0.5, 100, 1]);
	});

	it('returns an empty plan for a non-object payload', () => {
		expect(parsePlanFile('nope', known)).toEqual({ days: {} });
		expect(parsePlanFile(null, known)).toEqual({ days: {} });
	});
});

describe('prunePlan', () => {
	it('removes empty days while keeping order', () => {
		const plan = {
			days: {
				'2026-11-16': [{ slug: 'breakfast/easy-pancakes', scale: 1 }],
				'2026-11-17': []
			}
		};

		expect(prunePlan(plan)).toEqual({
			days: {
				'2026-11-16': [{ slug: 'breakfast/easy-pancakes', scale: 1 }]
			}
		});
	});
});
