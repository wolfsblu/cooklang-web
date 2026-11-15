import { describe, expect, it } from 'vitest';
import { normalizeFolder, recipeFileBase, RecipeCreateError } from './create';

describe('recipeFileBase', () => {
	it('keeps readable spaces and capitals', () => {
		expect(recipeFileBase('Bauerntopf mit Hackfleisch')).toBe('Bauerntopf mit Hackfleisch');
	});

	it('drops the .cook extension and characters a filesystem rejects', () => {
		expect(recipeFileBase('  Soup: "best" / ever?.cook ')).toBe('Soup best ever');
	});

	it('never returns an empty stem', () => {
		expect(recipeFileBase('...')).toBe('Imported recipe');
		expect(recipeFileBase('')).toBe('Imported recipe');
	});

	it('caps very long titles', () => {
		expect(recipeFileBase('a'.repeat(300))).toHaveLength(120);
	});
});

describe('normalizeFolder', () => {
	it('splits normal folder paths on either slash', () => {
		expect(normalizeFolder('Dinner/Quick')).toEqual(['Dinner', 'Quick']);
		expect(normalizeFolder('Dinner\\Quick')).toEqual(['Dinner', 'Quick']);
	});

	it('sanitises individual segments', () => {
		expect(normalizeFolder('Dinner: Quick / Soups')).toEqual(['Dinner Quick', 'Soups']);
	});

	it('rejects traversal and reserved directories', () => {
		expect(() => normalizeFolder('../secrets')).toThrow(RecipeCreateError);
		expect(() => normalizeFolder('Dinner/../secrets')).toThrow(RecipeCreateError);
		expect(() => normalizeFolder('config')).toThrow(/reserved/i);
		expect(() => normalizeFolder('db')).toThrow(/reserved/i);
	});
});
