import { describe, expect, it } from 'vitest';
import { cleanModelOutput, ensureFrontmatter, stripRedundantAmounts } from './output';

describe('cleanModelOutput', () => {
	it('unwraps a fenced Cooklang block', () => {
		expect(cleanModelOutput('```cooklang\ntitle: Soup\n---\nMix.\n```')).toBe(
			'title: Soup\n---\nMix.'
		);
	});

	it('unwraps a plain fenced block and trims chatter', () => {
		expect(cleanModelOutput('\n```\n---\ntitle: Soup\n---\nMix.\n```\n')).toBe(
			'---\ntitle: Soup\n---\nMix.'
		);
	});

	it('leaves unfenced source alone', () => {
		expect(cleanModelOutput('\n---\ntitle: Soup\n---\nMix.\n')).toBe('---\ntitle: Soup\n---\nMix.');
	});

	it('drops a short prose preface before the frontmatter', () => {
		expect(cleanModelOutput('Here is the recipe:\n\n---\ntitle: Soup\n---\nMix.')).toBe(
			'---\ntitle: Soup\n---\nMix.'
		);
	});
});

describe('ensureFrontmatter', () => {
	it('prepends frontmatter when the model omitted it', () => {
		expect(ensureFrontmatter('Mix the @flour{200%g}.', 'Soup', 'https://example.org/soup')).toBe(
			'---\ntitle: "Soup"\nsource: "https://example.org/soup"\n---\n\nMix the @flour{200%g}.\n'
		);
	});

	it('keeps an existing frontmatter block and fills in missing keys', () => {
		const result = ensureFrontmatter(
			'---\nservings: 2\n---\n\nMix the @flour{200%g}.',
			'Soup',
			'https://example.org/soup'
		);

		expect(result).toContain('servings: 2');
		expect(result).toContain('title: "Soup"');
		expect(result).toContain('source: "https://example.org/soup"');
		expect(result.endsWith('Mix the @flour{200%g}.\n')).toBe(true);
	});

	it('does not overwrite title or source already present', () => {
		const result = ensureFrontmatter(
			'---\ntitle: Model title\nsource: https://model.example/recipe\n---\n\nStep.',
			'Fallback',
			'https://pasted.example/recipe'
		);

		expect(result).toContain('title: Model title');
		expect(result).toContain('source: https://model.example/recipe');
		expect(result).not.toContain('Fallback');
		expect(result).not.toContain('pasted.example');
	});

	it('escapes quotes and backslashes in generated YAML strings', () => {
		const result = ensureFrontmatter('Step.', 'A "quoted" \\ title', 'https://example.org/a"b');
		expect(result).toContain('title: "A \\"quoted\\" \\\\ title"');
		expect(result).toContain('source: "https://example.org/a\\"b"');
	});
});

describe('stripRedundantAmounts', () => {
	it('removes a repeated approximate amount after an ingredient', () => {
		expect(
			stripRedundantAmounts(
				'Peel the @potatoes{500%g} and @carrots{2} (about 150 g) and cut them up.'
			)
		).toBe('Peel the @potatoes{500%g} and @carrots{2} and cut them up.');
	});

	it('handles parenthetical amounts with no space and different prefixes', () => {
		expect(stripRedundantAmounts('Add @bell peppers{2}(ca. 250 g) now.')).toBe(
			'Add @bell peppers{2} now.'
		);
		expect(stripRedundantAmounts('Add @onions{1} (150g).')).toBe('Add @onions{1}.');
	});

	it('keeps non-numeric preparation notes', () => {
		expect(stripRedundantAmounts('Add @tomatoes{2} (diced) and @cheese{50%g} (grated).')).toBe(
			'Add @tomatoes{2} (diced) and @cheese{50%g} (grated).'
		);
	});
});
