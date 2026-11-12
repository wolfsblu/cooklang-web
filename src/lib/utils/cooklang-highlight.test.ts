import { describe, expect, it } from 'vitest';
import { highlightCooklang, type CooklangTokenKind } from './cooklang-highlight';

function texts(source: string, kind: CooklangTokenKind): string[] {
	return highlightCooklang(source)
		.filter((token) => token.kind === kind)
		.map((token) => token.text);
}

describe('highlightCooklang', () => {
	it('round-trips the source exactly', () => {
		const source = [
			'---',
			'servings: 4',
			'tags: [dinner]',
			'---',
			'',
			'== Sauce ==',
			'',
			'Add @olive oil{2%tbsp} to the #pan{} and wait ~rest{5%minutes}.',
			'-- a comment',
			'>> title: Test'
		].join('\n');

		expect(
			highlightCooklang(source)
				.map((token) => token.text)
				.join('')
		).toBe(source);
	});

	it('highlights an ingredient name and its quantity separately', () => {
		expect(texts('Add @ground black pepper{2%tsp}.', 'ingredient')).toEqual([
			'@ground black pepper'
		]);
		expect(texts('Add @ground black pepper{2%tsp}.', 'ingredient-quantity')).toEqual(['{2%tsp}']);
	});

	it('does not swallow a following sentence after an unbraced ingredient', () => {
		expect(texts('Add @salt, then stir.', 'ingredient')).toEqual(['@salt']);
	});

	it('highlights cookware and timers', () => {
		expect(texts('Use #frying pan{} now.', 'cookware')).toEqual(['#frying pan']);
		expect(texts('Use #frying pan{} now.', 'cookware-quantity')).toEqual(['{}']);
		expect(texts('Wait ~rest{10%minutes}.', 'timer')).toEqual(['~rest']);
		expect(texts('Wait ~rest{10%minutes}.', 'timer-quantity')).toEqual(['{10%minutes}']);
	});

	it('leaves an escaped marker as text', () => {
		expect(texts('Write \\@salt literally.', 'ingredient')).toEqual([]);
	});

	it('highlights metadata, comments and sections', () => {
		expect(texts('>> servings: 4', 'metadata-key')).toEqual(['>> servings:']);
		expect(texts('>> servings: 4', 'metadata-value')).toEqual([' 4']);
		expect(texts('-- hidden', 'comment')).toEqual(['-- hidden']);
		expect(texts('== Sauce ==', 'section')).toEqual(['== Sauce ==']);
	});

	it('highlights YAML frontmatter keys and delimiters', () => {
		const source = '---\nservings: 4\n---';
		expect(texts(source, 'frontmatter-delimiter')).toEqual(['---', '---']);
		expect(texts(source, 'frontmatter-key')).toEqual(['servings:']);
		expect(texts(source, 'frontmatter')).toEqual([' 4']);
	});

	it('treats a midline comment as a comment', () => {
		expect(texts('Stir @salt{} -- not too much', 'comment')).toEqual(['-- not too much']);
	});

	it('handles an unclosed brace without dropping the line', () => {
		const source = 'Add @flour{2%cups';
		expect(texts(source, 'ingredient')).toEqual(['@flour']);
		expect(texts(source, 'ingredient-quantity')).toEqual(['{2%cups']);
	});
});
