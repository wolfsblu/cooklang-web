import { describe, expect, it } from 'vitest';
import {
	highlightSegments,
	rankFields,
	scoreText,
	tokenize,
	type SearchField
} from './search-match';

describe('tokenize', () => {
	it('lowercases and splits on whitespace', () => {
		expect(tokenize('  Chicken   CURRY ')).toEqual(['chicken', 'curry']);
	});

	it('returns nothing for an empty query', () => {
		expect(tokenize('   ')).toEqual([]);
	});
});

describe('scoreText', () => {
	it('prefers a prefix over a word-boundary match', () => {
		expect(scoreText('pancakes', 'pan')).toBeGreaterThan(scoreText('buttermilk pancakes', 'pan'));
	});

	it('prefers a word-boundary match over a match inside a word', () => {
		expect(scoreText('salted caramel', 'salt')).toBeGreaterThan(
			scoreText('unsalted butter', 'salt')
		);
	});

	it('matches a substring regardless of case', () => {
		expect(scoreText('Olive Oil', 'oil')).toBeGreaterThan(0);
	});

	it('tolerates a typo in a fuzzy-enabled field', () => {
		expect(scoreText('pancakes', 'pankakes', true)).toBeGreaterThan(0);
		expect(scoreText('tomatoes', 'tomatos', true)).toBeGreaterThan(0);
	});

	it('does not fuzzy-match unless the field opts in', () => {
		expect(scoreText('pancakes', 'pankakes')).toBe(0);
	});

	it('does not match a query scattered across unrelated words', () => {
		// The old subsequence matcher found t-o-a-s-t here and returned the
		// recipe for "toast".
		expect(scoreText('tortilla onions avocado salsa tomato', 'toast', true)).toBe(0);
	});

	it('does not fuzzy-match one- and two-character queries', () => {
		expect(scoreText('pancakes', 'pc', true)).toBe(0);
	});

	it('returns zero when nothing matches', () => {
		expect(scoreText('pancakes', 'zzz')).toBe(0);
	});
});

describe('rankFields', () => {
	const fields: SearchField[] = [
		{ text: 'Lemon chicken', weight: 10 },
		{ text: 'chicken lemon garlic', weight: 4 },
		{ text: 'A bright weeknight traybake', weight: 1 }
	];

	it('requires every term to match', () => {
		expect(rankFields(fields, 'lemon chicken')).toBeGreaterThan(0);
		expect(rankFields(fields, 'lemon beef')).toBe(0);
	});

	it('weights a title hit above the same hit in a weaker field', () => {
		const title = rankFields([{ text: 'lemon', weight: 10 }], 'lemon');
		const body = rankFields([{ text: 'lemon', weight: 1 }], 'lemon');
		expect(title).toBeGreaterThan(body);
	});

	it('returns zero for an empty query', () => {
		expect(rankFields(fields, '')).toBe(0);
	});
});

describe('highlightSegments', () => {
	it('marks every occurrence of every term', () => {
		expect(highlightSegments('Lemon chicken with lemon', 'lemon')).toEqual([
			{ text: 'Lemon', match: true },
			{ text: ' chicken with ', match: false },
			{ text: 'lemon', match: true }
		]);
	});

	it('merges overlapping terms', () => {
		expect(highlightSegments('pancakes', 'pan cake')).toEqual([
			{ text: 'pancake', match: true },
			{ text: 's', match: false }
		]);
	});

	it('returns the plain text when there is no query', () => {
		expect(highlightSegments('Pancakes', '')).toEqual([{ text: 'Pancakes', match: false }]);
	});

	it('returns the plain text when nothing matches literally', () => {
		expect(highlightSegments('Pancakes', 'zzz')).toEqual([{ text: 'Pancakes', match: false }]);
	});
});
