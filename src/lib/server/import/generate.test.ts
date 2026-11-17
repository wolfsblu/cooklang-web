import { describe, expect, it, vi } from 'vitest';
import type { CompletionTerm } from '#lib/types/editor.js';
import { generateRecipeFromMessages } from './generate';

const vocabulary: CompletionTerm[] = [
	{ name: 'flour', count: 4 },
	{ name: 'milk', count: 2 }
];

const messages = [{ role: 'user' as const, content: 'Make pancakes.' }];

const VALID = `---
title: Pancakes
servings: 2
---

Whisk the @flour{200%g} with @milk{250%ml} in a #mixing bowl{}.
`;

describe('generateRecipeFromMessages', () => {
	it('returns normalised source, a preview and library matches', async () => {
		const result = await generateRecipeFromMessages({
			messages,
			vocabulary,
			fallbackTitle: 'Fallback',
			sourceUrl: null,
			chat: async () => VALID
		});

		expect(result.source).toContain('title: Pancakes');
		expect(result.preview.display.title).toBe('Pancakes');
		expect(result.preview.display.ingredients.map((item) => item.name)).toEqual(['flour', 'milk']);
		expect(result.matches).toEqual([]);
	});

	it('adds a title but no source for a photo import', async () => {
		const result = await generateRecipeFromMessages({
			messages,
			vocabulary,
			fallbackTitle: 'Recipe from photo',
			sourceUrl: null,
			chat: async () => 'Mix the @flour{200%g}.'
		});

		expect(result.source).toContain('title: "Recipe from photo"');
		expect(result.source).not.toContain('source:');
	});

	it('reports the model sentinel as a friendly import failure', async () => {
		await expect(
			generateRecipeFromMessages({
				messages,
				vocabulary,
				fallbackTitle: 'Recipe from photo',
				sourceUrl: null,
				noRecipeMessage: 'No recipe text could be read from that photo.',
				chat: async () => 'NO_RECIPE'
			})
		).rejects.toThrow('No recipe text could be read from that photo.');
	});

	it('retries once when the first output cannot be parsed', async () => {
		const chat = vi
			.fn<() => Promise<string>>()
			.mockResolvedValueOnce('This is not a recipe.')
			.mockResolvedValueOnce(VALID);

		const result = await generateRecipeFromMessages({
			messages,
			vocabulary,
			fallbackTitle: 'Fallback',
			sourceUrl: null,
			chat
		});

		expect(chat).toHaveBeenCalledTimes(2);
		expect(result.preview.display.title).toBe('Pancakes');
	});

	it('gives up after the corrective pass', async () => {
		const chat = vi.fn<() => Promise<string>>().mockResolvedValue('Still not a recipe.');

		await expect(
			generateRecipeFromMessages({
				messages,
				vocabulary,
				fallbackTitle: 'Fallback',
				sourceUrl: null,
				chat
			})
		).rejects.toThrow(/no ingredients or steps/i);
		expect(chat).toHaveBeenCalledTimes(2);
	});
});
