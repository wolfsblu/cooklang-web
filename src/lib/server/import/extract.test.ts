import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, extractRecipe, parseDurationMinutes } from './extract';

const PAGE_URL = 'https://www.example.org/recipes/bauerntopf';

function pageWithJsonLd(recipe: unknown, extraNodes: unknown[] = []): string {
	return `<!doctype html>
<html lang="de">
<head><title>Fallback title</title></head>
<body>
<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [{ '@type': 'Organization', name: 'Example' }, ...extraNodes, recipe]
	})}</script>
</body>
</html>`;
}

describe('extractRecipe', () => {
	it('reads a schema.org Recipe out of a JSON-LD graph', () => {
		const html = pageWithJsonLd({
			'@type': 'Recipe',
			name: 'Bauerntopf',
			description: 'A hearty stew.',
			recipeYield: ['3', '3 Portionen'],
			prepTime: 'PT20M',
			cookTime: 'PT40M',
			totalTime: 'PT1H0M',
			recipeCategory: 'Rind',
			recipeCuisine: 'Deutsch',
			keywords: 'Fleisch, Gemüse, Eintopf',
			mainEntityOfPage: { '@id': 'https://www.example.org/recipes/bauerntopf?canonical' },
			recipeIngredient: ['500 g Kartoffeln', '2 Möhren', 'Salz'],
			recipeInstructions: [
				{
					'@type': 'HowToSection',
					name: 'Zubereitung',
					itemListElement: [
						{ '@type': 'HowToStep', text: 'Kartoffeln schälen.' },
						{ '@type': 'HowToStep', text: 'Alles köcheln lassen.' }
					]
				}
			]
		});

		const recipe = extractRecipe(html, PAGE_URL);

		expect(recipe.structured).toBe(true);
		expect(recipe.title).toBe('Bauerntopf');
		expect(recipe.description).toBe('A hearty stew.');
		expect(recipe.servings).toBe('3');
		expect(recipe.prepTimeMinutes).toBe(20);
		expect(recipe.cookTimeMinutes).toBe(40);
		expect(recipe.totalTimeMinutes).toBe(60);
		expect(recipe.category).toBe('Rind');
		expect(recipe.cuisine).toBe('Deutsch');
		expect(recipe.keywords).toEqual(['Fleisch', 'Gemüse', 'Eintopf']);
		expect(recipe.ingredients).toEqual(['500 g Kartoffeln', '2 Möhren', 'Salz']);
		expect(recipe.instructions).toEqual(['Kartoffeln schälen.', 'Alles köcheln lassen.']);
		expect(recipe.sourceUrl).toBe('https://www.example.org/recipes/bauerntopf?canonical');
	});

	it('resolves an image reference to its ImageObject URL', () => {
		const imageId = 'https://www.example.org/recipes/bauerntopf#primaryimage';
		const html = pageWithJsonLd(
			{
				'@type': 'Recipe',
				name: 'Bauerntopf',
				recipeIngredient: ['500 g potatoes'],
				recipeInstructions: ['Cook it.'],
				image: { '@id': imageId }
			},
			[
				{
					'@type': 'ImageObject',
					'@id': imageId,
					url: '/images/bauerntopf.jpg'
				}
			]
		);

		const recipe = extractRecipe(html, PAGE_URL);
		expect(recipe.imageUrl).toBe('https://www.example.org/images/bauerntopf.jpg');
	});

	it('picks the recipe with the useful ingredient and step lists', () => {
		const html = pageWithJsonLd([
			{ '@type': 'Recipe', name: 'Stub', recipeIngredient: ['water'] },
			{
				'@type': 'Recipe',
				name: 'Real recipe',
				recipeIngredient: ['200 g flour', '2 eggs'],
				recipeInstructions: [{ '@type': 'HowToStep', text: 'Mix and bake.' }]
			}
		]);

		const recipe = extractRecipe(html, PAGE_URL);
		expect(recipe.title).toBe('Real recipe');
		expect(recipe.ingredients).toHaveLength(2);
		expect(recipe.instructions).toEqual(['Mix and bake.']);
	});

	it('falls back to visible text when no recipe JSON-LD exists', () => {
		const html = `<!doctype html>
<html><head><title>Grandma&#39;s soup</title><style>.x{color:red}</style></head>
<body><script>window.secret = 'nope';</script>
<h1>Grandma's soup</h1>
<p>Fry the onions &amp; garlic.</p>
<p>Add stock and simmer.</p>
</body></html>`;

		const recipe = extractRecipe(html, PAGE_URL);

		expect(recipe.structured).toBe(false);
		expect(recipe.title).toBe("Grandma's soup");
		expect(recipe.ingredients).toEqual([]);
		expect(recipe.instructions).toEqual([]);
		expect(recipe.rawText).toContain('Fry the onions & garlic.');
		expect(recipe.rawText).toContain('Add stock and simmer.');
		expect(recipe.rawText).not.toContain('window.secret');
	});

	it('ignores broken JSON-LD and still reads a second valid block', () => {
		const good = JSON.stringify({
			'@type': 'Recipe',
			name: 'Working recipe',
			recipeIngredient: ['1 onion'],
			recipeInstructions: ['Chop it.']
		});
		const html = `<html><head></head><body>
<script type="application/ld+json">{ broken json</script>
<script type="application/ld+json">${good}</script>
</body></html>`;

		const recipe = extractRecipe(html, PAGE_URL);
		expect(recipe.title).toBe('Working recipe');
		expect(recipe.ingredients).toEqual(['1 onion']);
	});
});

describe('parseDurationMinutes', () => {
	it('parses ISO-8601 durations', () => {
		expect(parseDurationMinutes('PT20M')).toBe(20);
		expect(parseDurationMinutes('PT1H30M')).toBe(90);
		expect(parseDurationMinutes('P1DT2H')).toBe(1560);
		expect(parseDurationMinutes('PT45S')).toBe(1);
	});

	it('ignores values it does not understand', () => {
		expect(parseDurationMinutes('about 20 minutes')).toBeNull();
		expect(parseDurationMinutes('PT0S')).toBeNull();
		expect(parseDurationMinutes(undefined)).toBeNull();
	});
});

describe('decodeHtmlEntities', () => {
	it('decodes named, decimal and hex entities', () => {
		expect(decodeHtmlEntities('salt &amp; pepper &ndash; &#8217;ok&#x27;')).toBe(
			"salt & pepper – ’ok'"
		);
	});
});
