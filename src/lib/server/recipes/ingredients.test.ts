import { describe, expect, it } from 'vitest';
import type { CompletionTerm } from '#lib/types/editor.js';
import { canonicalizeIngredientNames, normalizeIngredientName } from './ingredients';

const vocabulary: CompletionTerm[] = [
	{ name: 'tinned tomatoes', count: 4 },
	{ name: 'sour cream', count: 2 },
	{ name: 'egg', count: 5 },
	{ name: 'red onion', count: 1 },
	{ name: 'onion', count: 3 },
	{ name: 'olive oil', count: 6 },
	{ name: 'flour', count: 8 },
	{ name: 'black pepper', count: 2 }
];

describe('normalizeIngredientName', () => {
	it('folds case, accents and punctuation', () => {
		expect(normalizeIngredientName('  Crème   Brûlée! ')).toBe('creme brulee');
		expect(normalizeIngredientName('salt & pepper')).toBe('salt and pepper');
	});
});

describe('canonicalizeIngredientNames', () => {
	it('reuses existing names for exact matches with different casing', () => {
		const result = canonicalizeIngredientNames(
			'Add the @Tinned Tomatoes{400%g} and @Black Pepper{}.',
			vocabulary
		);

		expect(result.source).toBe('Add the @tinned tomatoes{400%g} and @black pepper{}.');
		expect(result.matches).toEqual([
			{ from: 'Tinned Tomatoes', to: 'tinned tomatoes' },
			{ from: 'Black Pepper', to: 'black pepper' }
		]);
	});

	it('reuses existing names for singular and plural variants', () => {
		const result = canonicalizeIngredientNames(
			'Whisk @eggs{3}, then fold in @flours{200%g}.',
			vocabulary
		);

		expect(result.source).toBe('Whisk @egg{3}, then fold in @flour{200%g}.');
	});

	it('matches multi-word names and preserves their quantities and notes', () => {
		const result = canonicalizeIngredientNames(
			'Serve with @Sour Cream{2%tbsp} and drizzle @Olive Oils{1%splash}.',
			vocabulary
		);

		expect(result.source).toBe('Serve with @sour cream{2%tbsp} and drizzle @olive oil{1%splash}.');
	});

	it('does not collapse a qualified ingredient into a broader one', () => {
		const result = canonicalizeIngredientNames('Chop the @red onions{} and @onions{}.', vocabulary);

		expect(result.source).toBe('Chop the @red onion{} and @onion{}.');
	});

	it('leaves recipe references and unknown names alone', () => {
		const result = canonicalizeIngredientNames(
			'Use @./Shared/Pizza Dough{6%balls}, @halloumi{200%g} and @eggs{2}.',
			vocabulary
		);

		expect(result.source).toBe('Use @./Shared/Pizza Dough{6%balls}, @halloumi{200%g} and @egg{2}.');
	});

	it('rewrites unbraced names without adding braces', () => {
		const result = canonicalizeIngredientNames('Whisk @Eggs and stir in @flour.', vocabulary);
		expect(result.source).toBe('Whisk @egg and stir in @flour.');
	});
});
