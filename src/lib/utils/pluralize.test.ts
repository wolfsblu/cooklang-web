import { describe, expect, it } from 'vitest';
import { countLabel, pluralize } from './pluralize';

describe('pluralize', () => {
	it('uses the singular only for exactly one', () => {
		expect(pluralize(1, 'recipe')).toBe('recipe');
		expect(pluralize(0, 'recipe')).toBe('recipes');
		expect(pluralize(2, 'recipe')).toBe('recipes');
	});

	it('accepts an irregular plural', () => {
		expect(pluralize(2, 'batch', 'batches')).toBe('batches');
	});

	it('does not mistake a fractional count for one', () => {
		expect(pluralize(1.5, 'serving')).toBe('servings');
	});
});

describe('countLabel', () => {
	it('joins the count and noun', () => {
		expect(countLabel(1, 'step')).toBe('1 step');
		expect(countLabel(4, 'step')).toBe('4 steps');
	});

	it('passes an irregular plural through', () => {
		expect(countLabel(2, 'batch', 'batches')).toBe('2 batches');
	});
});
