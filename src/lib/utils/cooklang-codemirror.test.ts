import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { cooklangDiagnostics, cooklangLanguage } from './cooklang-codemirror';

interface Token {
	name: string;
	text: string;
}

/** Parse a source with the stream language and list its styled runs. */
function tokens(source: string): Token[] {
	const state = EditorState.create({ doc: source, extensions: [cooklangLanguage] });
	const tree = ensureSyntaxTree(state, source.length, 5000);
	if (!tree) throw new Error('the stream language did not finish parsing');

	const result: Token[] = [];
	tree.iterate({
		enter: (node) => {
			if (node.name === 'Document') return;
			result.push({ name: node.name, text: source.slice(node.from, node.to) });
		}
	});

	return result;
}

function texts(source: string, name: string): string[] {
	return tokens(source)
		.filter((token) => token.name === name)
		.map((token) => token.text);
}

describe('cooklangLanguage', () => {
	it('highlights an ingredient name and its quantity separately', () => {
		expect(texts('Add @ground black pepper{2%tsp}.', 'ingredient')).toEqual([
			'@ground black pepper'
		]);
		expect(texts('Add @ground black pepper{2%tsp}.', 'ingredientQuantity')).toEqual(['{2%tsp}']);
	});

	it('highlights notes after the quantity or name', () => {
		expect(texts('Add @onion{1}(diced) now.', 'note')).toEqual(['(diced)']);
		expect(texts('Add @onion(diced) now.', 'note')).toEqual(['(diced)']);
		expect(texts('Use #pan{1}(large) now.', 'note')).toEqual(['(large)']);
	});

	it('does not swallow a following sentence after an unbraced ingredient', () => {
		expect(texts('Add @salt, then stir.', 'ingredient')).toEqual(['@salt']);
	});

	it('highlights cookware and timers', () => {
		expect(texts('Use #frying pan{} now.', 'cookware')).toEqual(['#frying pan']);
		expect(texts('Use #frying pan{} now.', 'cookwareQuantity')).toEqual(['{}']);
		expect(texts('Wait ~rest{10%minutes}.', 'timer')).toEqual(['~rest']);
		expect(texts('Wait ~rest{10%minutes}.', 'timerQuantity')).toEqual(['{10%minutes}']);
	});

	it('leaves an escaped marker as text', () => {
		expect(texts('Write \\@salt literally.', 'ingredient')).toEqual([]);
	});

	it('highlights metadata, comments and sections', () => {
		expect(texts('>> servings: 4', 'metadataKey')).toEqual(['>> servings:']);
		expect(texts('>> servings: 4', 'metadataValue')).toEqual([' 4']);
		expect(texts('-- hidden', 'comment')).toEqual(['-- hidden']);
		expect(texts('== Sauce ==', 'section')).toEqual(['== Sauce ==']);
	});

	it('highlights YAML frontmatter keys and delimiters', () => {
		const source = '---\nservings: 4\n---';
		expect(texts(source, 'frontmatterDelimiter')).toEqual(['---', '---']);
		expect(texts(source, 'frontmatterKey')).toEqual(['servings:']);
		expect(texts(source, 'frontmatter')).toEqual([' 4']);
	});

	it('treats a midline comment as a comment', () => {
		expect(texts('Stir @salt{} -- not too much', 'comment')).toEqual(['-- not too much']);
	});

	it('handles an unclosed brace without dropping the line', () => {
		const source = 'Add @flour{2%cups';
		expect(texts(source, 'ingredient')).toEqual(['@flour']);
		expect(texts(source, 'ingredientQuantity')).toEqual(['{2%cups']);
	});
});

describe('cooklangDiagnostics', () => {
	const state = EditorState.create({ doc: 'one\ntwo\nlong line' });

	it('maps a line number to the whole line', () => {
		const [diagnostic] = cooklangDiagnostics(state, [
			{ severity: 'warning', message: 'careful', line: 2 }
		]);

		expect(diagnostic).toMatchObject({
			from: 4,
			to: 7,
			severity: 'warning',
			message: 'careful',
			source: 'Cooklang'
		});
	});

	it('clamps a line past the end of the document to the last line', () => {
		const [diagnostic] = cooklangDiagnostics(state, [
			{ severity: 'error', message: 'broken', line: 99 }
		]);

		expect(diagnostic).toMatchObject({ from: 8, to: 17 });
	});

	it('skips diagnostics that point at no line', () => {
		expect(
			cooklangDiagnostics(state, [{ severity: 'error', message: 'global', line: null }])
		).toEqual([]);
	});

	it('maps help to an info severity', () => {
		const [diagnostic] = cooklangDiagnostics(state, [
			{ severity: 'help', message: 'tip', line: 1 }
		]);

		expect(diagnostic.severity).toBe('info');
	});
});
