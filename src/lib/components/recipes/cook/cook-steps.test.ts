import { describe, expect, it } from 'vitest';
import type { SectionDisplay } from '#lib/types/recipe.js';
import { cookStepSummary, flattenCookSteps } from './cook-steps';

function section(name: string | null, stepTexts: string[]): SectionDisplay {
	return {
		name,
		content: stepTexts.map((value, index) => ({
			type: 'step' as const,
			// Cooklang restarts this inside every section.
			number: index + 1,
			items: [{ type: 'text' as const, value }]
		}))
	};
}

describe('flattenCookSteps', () => {
	it('counts ordinally across sections rather than using section-local numbers', () => {
		const steps = flattenCookSteps([
			section('First', ['Crack the eggs', 'Pour into a bowl']),
			section('Second', ['Whisk the batter'])
		]);

		expect(steps.map((step) => step.ordinal)).toEqual([1, 2, 3]);
		expect(steps.map((step) => step.step.number)).toEqual([1, 2, 1]);
		expect(steps.map((step) => step.sectionName)).toEqual(['First', 'First', 'Second']);
	});

	it('names unnamed sections only when there is more than one', () => {
		expect(flattenCookSteps([section(null, ['Only step'])])[0].sectionName).toBeNull();

		expect(
			flattenCookSteps([section(null, ['One']), section(null, ['Two'])]).map(
				(step) => step.sectionName
			)
		).toEqual(['Section 1', 'Section 2']);
	});
});

describe('cookStepSummary', () => {
	it('summarizes inline entities as plain text', () => {
		const [step] = flattenCookSteps([
			{
				name: null,
				content: [
					{
						type: 'step',
						number: 1,
						items: [
							{ type: 'text', value: 'Whisk ' },
							{ type: 'ingredient', index: 0, name: 'flour', quantity: '125 g' },
							{ type: 'text', value: ' in the ' },
							{ type: 'cookware', index: 0, name: 'bowl', quantity: null },
							{ type: 'text', value: '.' }
						]
					}
				]
			}
		]);

		expect(cookStepSummary(step.step)).toBe('Whisk flour in the bowl.');
	});

	it('clips long steps at a word boundary', () => {
		const [step] = flattenCookSteps([
			section(null, [
				'Cook the pancakes until the edges are set and the surface is covered in bubbles, then flip them once.'
			])
		]);

		const summary = cookStepSummary(step.step, 40);

		expect(summary.endsWith('…')).toBe(true);
		expect(summary.length).toBeLessThanOrEqual(41);
		expect(summary).not.toContain('bubbles');
	});

	it('returns an empty string for a step with no content', () => {
		expect(cookStepSummary({ type: 'step', number: 1, items: [] })).toBe('');
	});
});
