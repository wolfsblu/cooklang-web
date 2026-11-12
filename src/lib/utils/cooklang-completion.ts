/**
 * Autocomplete for Cooklang recipe source.
 *
 * The editor calls this on every keystroke. It is deliberately pure: the
 * textarea remains the source of truth, and a completion is just a range to
 * replace plus the caret position afterwards. That keeps the behaviour easy to
 * test without a DOM and means accepting a suggestion cannot leave the browser
 * undo stack in a strange state.
 */

import type { CompletionKind, CompletionTerm } from '$lib/types/editor';

export interface CompletionContext {
	kind: CompletionKind;
	/** Index of the `@` or `#` that opened the context. */
	start: number;
	/** Caret position when the context was detected. */
	end: number;
	/** Text typed since the trigger. */
	query: string;
	trigger: '@' | '#';
}

const TRIGGERS: Record<string, CompletionKind> = {
	'@': 'ingredient',
	'#': 'cookware'
};

/**
 * Find a completion context at the caret.
 *
 * Only the current line is considered. The scan stops at braces because once
 * the name is closed the user is editing a quantity, not the name. An escaped
 * `\@` is not a trigger, and neither is an `@` glued to a word (an email or a
 * social handle), which would otherwise open a menu in the middle of prose.
 */
export function detectCompletionContext(source: string, caret: number): CompletionContext | null {
	if (caret < 0 || caret > source.length) return null;

	const lineStart = source.lastIndexOf('\n', caret - 1) + 1;
	const lineBeforeCaret = source.slice(lineStart, caret);

	// A line that is entirely a comment is prose, not recipe syntax.
	if (lineBeforeCaret.trimStart().startsWith('--')) return null;

	let triggerPos = -1;
	for (let i = caret - 1; i >= lineStart; i--) {
		const char = source[i];

		if (char === '@' || char === '#') {
			triggerPos = i;
			break;
		}

		// Braces close the name; another entity starts a new context.
		if (char === '{' || char === '}' || char === '~') return null;
	}

	if (triggerPos < 0) return null;

	// An odd number of backslashes escapes the trigger.
	let slashes = 0;
	for (let i = triggerPos - 1; i >= 0 && source[i] === '\\'; i--) slashes++;
	if (slashes % 2 === 1) return null;

	const trigger = source[triggerPos] as '@' | '#';
	const kind = TRIGGERS[trigger];
	if (!kind) return null;

	const previous = triggerPos > lineStart ? source[triggerPos - 1] : '';
	if (previous && /[\p{L}\p{N}._%+-]/u.test(previous)) return null;

	const query = source.slice(triggerPos + 1, caret);

	// Another marker inside the token means this is not a name context.
	if (/[@#~]/u.test(query)) return null;

	return { kind, start: triggerPos, end: caret, query, trigger };
}

/** Prefix, substring and loose-subsequence matching, in that order. */
function matchScore(name: string, query: string): number {
	if (!query) return 1;

	const haystack = name.toLocaleLowerCase();
	const needle = query.toLocaleLowerCase();

	if (haystack === needle) return 100;
	if (haystack.startsWith(needle)) return 80 - Math.min(haystack.length - needle.length, 19) / 100;

	const wordStart = haystack.split(/[\s\-_/]+/u).some((word) => word.startsWith(needle));
	if (wordStart) return 60;

	const substring = haystack.indexOf(needle);
	if (substring >= 0) return 40 - Math.min(substring, 19) / 100;

	// "ovl" should still find "olive oil"; this is a convenience, not the
	// primary match, so it ranks below every literal match.
	let cursor = 0;
	for (const char of haystack) {
		if (char === needle[cursor]) cursor++;
		if (cursor === needle.length) return 20;
	}

	return 0;
}

/** Rank candidates for the menu. Empty queries list the most-used names. */
export function rankCompletions(
	terms: readonly CompletionTerm[],
	query: string,
	limit = 8
): CompletionTerm[] {
	const trimmed = query.trim();

	return terms
		.map((term) => ({ term, score: matchScore(term.name, trimmed) }))
		.filter((candidate) => candidate.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score || b.term.count - a.term.count || a.term.name.localeCompare(b.term.name)
		)
		.slice(0, Math.max(0, limit))
		.map((candidate) => candidate.term);
}

/**
 * Merge the library vocabulary with names already used in the open document.
 *
 * A recipe that was just typed may mention something nobody else has used yet;
 * it belongs in the menu immediately. Existing library entries keep their
 * canonical spelling, which matters because the shopping list matches names
 * exactly.
 */
export function mergeCompletionTerms(
	terms: readonly CompletionTerm[],
	localNames: readonly string[]
): CompletionTerm[] {
	const merged = new Map<string, CompletionTerm>();

	for (const term of terms) {
		const name = term.name.trim();
		if (!name) continue;
		merged.set(name.toLocaleLowerCase(), { name, count: Math.max(1, term.count) });
	}

	for (const rawName of localNames) {
		const name = rawName.trim();
		if (!name) continue;

		const key = name.toLocaleLowerCase();
		const existing = merged.get(key);
		if (existing) {
			existing.count++;
		} else {
			merged.set(key, { name, count: 1 });
		}
	}

	return [...merged.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface CompletionResult {
	source: string;
	caret: number;
}

/**
 * Whether a selection or caret sits inside an existing `@`, `#` or `~` entity.
 *
 * Toolbar wrapping is not safe there: wrapping the name of `@flour{}` again
 * produces `@@flour{}{}`, which is not valid Cooklang. The editor uses this to
 * make a second click on the same insert button a no-op rather than corrupting
 * the token (a double click otherwise wraps the placeholder the first click
 * just selected).
 */
export function isInsideEntity(source: string, start: number, end: number): boolean {
	if (!source) return false;

	const boundedStart = Math.max(0, Math.min(start, source.length));
	const boundedEnd = Math.max(boundedStart, Math.min(end, source.length));

	const lineStart = boundedStart === 0 ? 0 : source.lastIndexOf('\n', boundedStart - 1) + 1;
	const lineBreak = source.indexOf('\n', boundedEnd);
	const line = source.slice(lineStart, lineBreak === -1 ? source.length : lineBreak);

	const relativeStart = boundedStart - lineStart;
	const relativeEnd = Math.min(boundedEnd - lineStart, line.length);

	// Braced names may contain spaces; unbraced names stop at whitespace.
	// Another trigger before the brace means the braced alternative did not
	// start here, so the entity is the unbraced one.
	const entities = /[@#~](?:[^@#~{}\n.,;:!?]*\{[^}]*\}|[^\s@#~{}]*)/gu;

	for (const match of line.matchAll(entities)) {
		const from = match.index;
		const to = from + match[0].length;

		if (relativeEnd > from && relativeStart < to) return true;
	}

	return false;
}

/**
 * Replace the token at the caret with a completed name.
 *
 * Braces are added when they are not already there, and the caret is placed
 * inside them: `@olive oil{}` with the cursor ready for a quantity. That is
 * the form the parser needs for a multi-word name, so this is not merely a
 * convenience.
 */
export function applyCompletion(
	source: string,
	context: CompletionContext,
	name: string
): CompletionResult {
	const after = source.slice(context.end);
	const hasBraces = after.startsWith('{');
	const token = `${context.trigger}${name}${hasBraces ? '' : '{}'}`;

	return {
		source: source.slice(0, context.start) + token + after,
		// Always land inside the opening brace, whether it was just added or
		// already part of the document. That is where a quantity goes next.
		caret: context.start + context.trigger.length + name.length + 1
	};
}
