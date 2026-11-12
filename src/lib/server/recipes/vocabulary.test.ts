import { describe, expect, it } from 'vitest';
import { buildVocabulary } from './vocabulary';

describe('buildVocabulary', () => {
	it('dedupes case-insensitively and counts recipes, not occurrences', () => {
		const vocabulary = buildVocabulary([
			{ ingredientNames: ['flour', 'salt'], cookwareNames: ['pan'] },
			{ ingredientNames: ['Flour'], cookwareNames: ['Pan', 'pot'] }
		]);

		expect(vocabulary.ingredients).toEqual([
			{ name: 'flour', count: 2 },
			{ name: 'salt', count: 1 }
		]);
		expect(vocabulary.cookware).toEqual([
			{ name: 'pan', count: 2 },
			{ name: 'pot', count: 1 }
		]);
	});

	it('sorts by usage and then alphabetically', () => {
		const vocabulary = buildVocabulary([
			{ ingredientNames: ['salt', 'pepper'], cookwareNames: [] },
			{ ingredientNames: ['salt', 'apple'], cookwareNames: [] }
		]);

		expect(vocabulary.ingredients.map((term) => term.name)).toEqual(['salt', 'apple', 'pepper']);
	});

	it('ignores blank names and missing cookware fields', () => {
		const vocabulary = buildVocabulary([{ ingredientNames: ['', '  ', 'salt'] }]);
		expect(vocabulary.ingredients).toEqual([{ name: 'salt', count: 1 }]);
		expect(vocabulary.cookware).toEqual([]);
	});
});
