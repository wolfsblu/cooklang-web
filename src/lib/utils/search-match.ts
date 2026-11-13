/**
 * Shared text matching for search.
 *
 * The same rules rank every corpus (recipes, ingredients, aisles and pantry
 * items), so a query behaves the same whichever group it lands in. The
 * highlight helper is here too: the server ranks matches and the client draws
 * them, and keeping both in one module stops the two from disagreeing about
 * what counts as a match.
 */

/** A field of a searchable record, and how much a hit there is worth. */
export interface SearchField {
	text: string;
	weight: number;
	/**
	 * Allow typo tolerance in this field. Only set this for short labels such
	 * as titles and ingredient names: fuzzy-matching a whole recipe body finds
	 * a "t-o-a-s-t" scattered through unrelated prose.
	 */
	fuzzy?: boolean;
}

export interface HighlightSegment {
	text: string;
	match: boolean;
}

/**
 * Split a query into the terms every result must contain.
 *
 * Lowercased and whitespace-delimited: there is no query syntax to parse, so
 * "chicken curry" narrows to records containing both words rather than one.
 */
export function tokenize(query: string): string[] {
	return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function isWordBoundary(char: string | undefined): boolean {
	return char === undefined || !/[a-z0-9]/.test(char);
}

/** Words in a lowercased label, used for typo tolerance. */
const WORD_RE = /[a-z0-9]+/g;

/**
 * Levenshtein distance, bounded. Returns `max + 1` as soon as the distance
 * cannot fall back under the bound, which keeps typo checks cheap.
 */
function boundedDistance(a: string, b: string, max: number): number {
	if (Math.abs(a.length - b.length) > max) return max + 1;

	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	let current = new Array<number>(b.length + 1);

	for (let i = 1; i <= a.length; i++) {
		current[0] = i;
		let rowMin = current[0];

		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
			if (current[j] < rowMin) rowMin = current[j];
		}

		if (rowMin > max) return max + 1;

		[previous, current] = [current, previous];
	}

	return previous[b.length];
}

/**
 * Typo tolerance for short labels: compare the term against each word, and
 * against the same-length prefix of longer words so a missing ending still
 * counts ("tomatos" -> "tomatoes", "pancakse" -> "pancakes").
 *
 * Deliberately not a subsequence match. Allowing any characters in order turns
 * "toast" into a hit for anything containing those letters in a sentence, and
 * a whole recipe body is long enough that this matches almost everything.
 */
function typoScore(text: string, term: string): number {
	if (term.length < 4) return 0;

	// One edit for short words, two once there is enough word to be confident
	// the difference is a typo rather than a different word.
	const max = term.length >= 7 ? 2 : 1;
	let best = 0;

	for (const match of text.toLowerCase().matchAll(WORD_RE)) {
		const word = match[0];

		const candidates = [word];
		if (word.length > term.length) {
			candidates.push(word.slice(0, term.length), word.slice(0, term.length + 1));
		}

		for (const candidate of candidates) {
			if (candidate === term) continue;

			const distance = boundedDistance(term, candidate, max);
			if (distance > max) continue;

			// Fuzzy hits sit below every literal match, which starts at 100.
			best = Math.max(best, 60 - distance * 15);
		}
	}

	return best;
}

/**
 * Score one term against one string. Zero means no match.
 *
 * A literal match is worth 100 plus bonuses for a prefix, a word start and a
 * whole-field match. Typo matches are only considered for fields marked
 * `fuzzy`, and never reach a literal hit.
 */
export function scoreText(text: string, term: string, fuzzy = false): number {
	if (!term) return 0;

	const haystack = text.toLowerCase();
	const at = haystack.indexOf(term);
	if (at !== -1) {
		let score = 100 + Math.min(term.length, 20) * 2;

		if (at === 0) score += 80;
		else if (isWordBoundary(haystack[at - 1])) score += 40;

		// The whole field, or a whole word inside it. "salt" in a tag list is a
		// much stronger signal than "salt" inside "salted caramel".
		const endsWord = isWordBoundary(haystack[at + term.length]);
		if (at === 0 && haystack.length === term.length) score += 60;
		else if (isWordBoundary(haystack[at - 1]) && endsWord) score += 30;

		return score;
	}

	return fuzzy ? typoScore(haystack, term) : 0;
}

/**
 * Rank a record by its fields. Every query term must appear in at least one
 * field, otherwise the record does not match at all.
 *
 * Each term contributes the best weighted field hit, so a title match beats
 * the same word appearing only in a recipe's body.
 */
export function rankFields(fields: readonly SearchField[], query: string): number {
	const terms = tokenize(query);
	if (terms.length === 0) return 0;

	let total = 0;

	for (const term of terms) {
		let best = 0;

		for (const field of fields) {
			if (!field.text) continue;
			const score = scoreText(field.text, term, field.fuzzy) * field.weight;
			if (score > best) best = score;
		}

		if (best === 0) return 0;
		total += best;
	}

	return total;
}

/**
 * Cut `text` into plain and matched runs for display.
 *
 * Only literal occurrences are highlighted; a fuzzy match still appears in the
 * results, just without a fragment highlighted. Overlapping terms are merged so
 * the markup stays valid.
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
	const terms = tokenize(query);
	if (terms.length === 0) return text ? [{ text, match: false }] : [];

	const haystack = text.toLowerCase();
	const ranges: [number, number][] = [];

	for (const term of terms) {
		let from = 0;
		while (from <= haystack.length) {
			const at = haystack.indexOf(term, from);
			if (at === -1) break;
			ranges.push([at, at + term.length]);
			// Advancing by the term length rather than one character keeps the
			// scan linear-ish for a term that is itself repeated.
			from = at + Math.max(term.length, 1);
		}
	}

	if (ranges.length === 0) return [{ text, match: false }];

	ranges.sort((a, b) => a[0] - b[0]);

	const merged: [number, number][] = [];
	for (const range of ranges) {
		const previous = merged.at(-1);
		if (previous && range[0] <= previous[1]) {
			previous[1] = Math.max(previous[1], range[1]);
		} else {
			merged.push([range[0], range[1]]);
		}
	}

	const segments: HighlightSegment[] = [];
	let cursor = 0;

	for (const [start, end] of merged) {
		if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
		segments.push({ text: text.slice(start, end), match: true });
		cursor = end;
	}

	if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });

	return segments;
}
