import { describe, expect, it } from 'vitest';
import { previewRecipe } from './parse';

describe('previewRecipe', () => {
	it('uses the file-name fallback until the recipe declares a title', () => {
		const preview = previewRecipe('Add @flour{2%cups}.', 'Easy Pancakes');

		expect(preview.display.title).toBe('Easy Pancakes');
		expect(preview.display.ingredients.map((ingredient) => ingredient.name)).toEqual(['flour']);
	});

	it('maps steps, ingredients and inline quantities', () => {
		const preview = previewRecipe(
			'Add @flour{2%cups} and @salt{} to the #bowl{}.\n\nWait ~rest{5%minutes}.'
		);

		const steps = preview.display.sections.flatMap((section) =>
			section.content.filter((item) => item.type === 'step')
		);
		const items = steps.flatMap((step) => (step.type === 'step' ? step.items : []));

		expect(items.some((item) => item.type === 'ingredient')).toBe(true);
		expect(items.some((item) => item.type === 'cookware')).toBe(true);
		expect(items.some((item) => item.type === 'timer')).toBe(true);
	});

	it('keeps ingredient and cookware notes in the preview model', () => {
		const preview = previewRecipe('Add @onion{1}(diced) to the #pan{1}(large).');

		expect(preview.display.ingredients[0].note).toBe('diced');
		expect(preview.display.cookware[0].note).toBe('large');
	});

	it('surfaces parser warnings as diagnostics', () => {
		const preview = previewRecipe('>> servings: 2\n\nAdd @flour{}.');
		expect(preview.diagnostics.some((diagnostic) => diagnostic.severity === 'warning')).toBe(true);
	});

	it('explains an empty ingredient instead of letting the WASM parser panic', () => {
		expect(() => previewRecipe('Add @{} to the end.')).toThrowError(
			'An ingredient name is missing before the braces.'
		);
	});

	it('returns a preview without diagnostics for clean source', () => {
		const preview = previewRecipe('---\nservings: 2\n---\n\nAdd @flour{}.');
		expect(preview.diagnostics).toEqual([]);
	});
});
