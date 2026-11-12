import { describe, expect, it } from 'vitest';
import {
	applyCompletion,
	detectCompletionContext,
	isInsideEntity,
	mergeCompletionTerms,
	rankCompletions
} from './cooklang-completion';

describe('detectCompletionContext', () => {
	it('detects an ingredient after @', () => {
		const source = 'Add @oli';
		const context = detectCompletionContext(source, source.length);

		expect(context).toEqual({
			kind: 'ingredient',
			start: 4,
			end: 8,
			query: 'oli',
			trigger: '@'
		});
	});

	it('detects cookware after # and keeps spaces in the query', () => {
		const source = 'Use #frying pa';
		const context = detectCompletionContext(source, source.length);

		expect(context?.kind).toBe('cookware');
		expect(context?.query).toBe('frying pa');
	});

	it('does not trigger once the name is closed', () => {
		const source = 'Add @flour{2%cups}';
		expect(detectCompletionContext(source, source.length)).toBeNull();
	});

	it('does not treat an escaped or embedded @ as syntax', () => {
		expect(detectCompletionContext('Mail me at foo@bar.com', 20)).toBeNull();
		expect(detectCompletionContext('Literal \\@salt', 13)).toBeNull();
	});

	it('ignores triggers in a comment line', () => {
		expect(detectCompletionContext('-- try @salt', 12)).toBeNull();
	});

	it('finds the nearest trigger on the line', () => {
		const source = 'Add @salt and @pep';
		const context = detectCompletionContext(source, source.length);
		expect(context?.query).toBe('pep');
	});
});

describe('rankCompletions', () => {
	const terms = [
		{ name: 'salt', count: 10 },
		{ name: 'sea salt', count: 20 },
		{ name: 'salted butter', count: 3 },
		{ name: 'pepper', count: 2 }
	];

	it('puts an exact prefix first and uses usage as a tie-breaker', () => {
		expect(rankCompletions(terms, 'salt').map((term) => term.name)).toEqual([
			'salt',
			'salted butter',
			'sea salt'
		]);
	});

	it('falls back to a word-start match', () => {
		expect(rankCompletions(terms, 'salt').map((term) => term.name)).toContain('sea salt');
	});

	it('returns the most-used names for an empty query', () => {
		expect(rankCompletions(terms, '').map((term) => term.name)).toEqual([
			'sea salt',
			'salt',
			'salted butter',
			'pepper'
		]);
	});

	it('honours the limit', () => {
		expect(rankCompletions(terms, 's', 2)).toHaveLength(2);
	});

	it('returns nothing for a query that matches nothing', () => {
		expect(rankCompletions(terms, 'zzz')).toEqual([]);
	});
});

describe('mergeCompletionTerms', () => {
	it('adds document-local names and boosts names already in the library', () => {
		const merged = mergeCompletionTerms(
			[
				{ name: 'flour', count: 4 },
				{ name: 'salt', count: 2 }
			],
			['Flour', 'nutmeg']
		);

		expect(merged.find((term) => term.name === 'flour')?.count).toBe(5);
		expect(merged.find((term) => term.name === 'nutmeg')).toEqual({ name: 'nutmeg', count: 1 });
	});

	it('keeps the first spelling rather than offering case duplicates', () => {
		const merged = mergeCompletionTerms([{ name: 'Olive Oil', count: 1 }], ['olive oil']);
		expect(merged).toHaveLength(1);
		expect(merged[0].name).toBe('Olive Oil');
	});
});

describe('applyCompletion', () => {
	it('adds braces and places the caret inside them', () => {
		const source = 'Add @oli and stir.';
		const context = detectCompletionContext(source, 8)!;
		const result = applyCompletion(source, context, 'olive oil');

		expect(result.source).toBe('Add @olive oil{} and stir.');
		expect(result.caret).toBe('Add @olive oil{'.length);
	});

	it('does not duplicate braces that are already present', () => {
		const source = 'Add @fl{}';
		const context = detectCompletionContext(source, 7)!;
		const result = applyCompletion(source, context, 'flour');

		expect(result.source).toBe('Add @flour{}');
		expect(result.caret).toBe('Add @flour{'.length);
	});

	it('completes cookware with the # trigger', () => {
		const source = 'Use #pa';
		const context = detectCompletionContext(source, source.length)!;
		expect(applyCompletion(source, context, 'pan').source).toBe('Use #pan{}');
	});
});

describe('isInsideEntity', () => {
	it('detects a selection inside an ingredient name', () => {
		const source = 'Add @ingredient{} now.';
		expect(isInsideEntity(source, 5, 15)).toBe(true);
	});

	it('detects a caret inside a multi-word name or quantity', () => {
		const source = 'Add @olive oil{2%tbsp} now.';
		expect(isInsideEntity(source, 12, 12)).toBe(true);
		expect(isInsideEntity(source, 18, 18)).toBe(true);
	});

	it('detects unbraced ingredients and cookware', () => {
		expect(isInsideEntity('Add @salt now.', 8, 8)).toBe(true);
		expect(isInsideEntity('Use #pan now.', 7, 7)).toBe(true);
	});

	it('does not flag prose around or between entities', () => {
		expect(isInsideEntity('Add @salt and @pepper{} now.', 9, 13)).toBe(false);
		expect(isInsideEntity('Add @salt now.', 0, 4)).toBe(false);
	});

	it('does not flag a caret immediately after an entity', () => {
		const source = 'Add @salt{} now.';
		expect(isInsideEntity(source, 11, 11)).toBe(false);
	});
});
