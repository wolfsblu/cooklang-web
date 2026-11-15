/**
 * Cooklang language support for CodeMirror 6.
 *
 * The tokenizer is deliberately forgiving: the parser is the authority on
 * validity, and highlighting partial syntax while the user is mid-word must
 * not flicker or swallow the rest of the line.
 */

import type {
	Completion,
	CompletionContext as CMCompletionContext,
	CompletionResult
} from '@codemirror/autocomplete';
import {
	HighlightStyle,
	StreamLanguage,
	syntaxHighlighting,
	type StringStream
} from '@codemirror/language';
import { Tag, tags } from '@lezer/highlight';
import type { Diagnostic } from '@codemirror/lint';
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { CompletionTerm, RecipeDiagnostic } from '#lib/types/editor.js';
import { detectCompletionContext, rankCompletions } from '#lib/utils/cooklang-completion.js';

interface StreamState {
	/** Inside a YAML frontmatter block. */
	frontmatter: boolean;
	/** A line other than the opening `---` has been seen. */
	seenContent: boolean;
	/** The key of a `>> key: value` line has been consumed. */
	metadataValue: boolean;
	/** An entity name was just emitted; `{` or `(` may follow. */
	afterEntity: boolean;
	/** Trigger character of the entity just emitted. */
	entityTrigger: '@' | '#' | '~';
}

const ENTITY_TRIGGERS = new Set(['@', '#', '~']);
const BRACES = /^\{(?:[^}\\]|\\.)*\}?/u;
const PARENS = /^\((?:[^)\\]|\\.)*\)?/u;

function startState(): StreamState {
	return {
		frontmatter: false,
		seenContent: false,
		metadataValue: false,
		afterEntity: false,
		entityTrigger: '@'
	};
}

function entityNameToken(trigger: string): string {
	if (trigger === '@') return 'ingredient';
	if (trigger === '#') return 'cookware';
	return 'timer';
}

function entityQuantityToken(trigger: string): string {
	if (trigger === '@') return 'ingredientQuantity';
	if (trigger === '#') return 'cookwareQuantity';
	return 'timerQuantity';
}

function token(stream: StringStream, state: StreamState): string | null {
	// Line-level constructs are decided once, at the start of the line.
	if (stream.sol()) {
		state.metadataValue = false;
		state.afterEntity = false;

		const line = stream.string.slice(stream.pos);
		const trimmed = line.trim();

		if (!state.seenContent && trimmed === '---') {
			state.frontmatter = true;
			state.seenContent = true;
			stream.skipToEnd();
			return 'frontmatterDelimiter';
		}

		if (state.frontmatter) {
			if (trimmed === '---') {
				state.frontmatter = false;
				stream.skipToEnd();
				return 'frontmatterDelimiter';
			}

			const colon = line.indexOf(':');
			if (colon > 0) {
				stream.pos += colon + 1;
				return 'frontmatterKey';
			}

			stream.skipToEnd();
			return 'frontmatter';
		}

		if (trimmed === '') {
			stream.skipToEnd();
			return null;
		}

		state.seenContent = true;

		if (trimmed.startsWith('--')) {
			stream.skipToEnd();
			return 'comment';
		}

		if (/^==.*==$/u.test(trimmed)) {
			stream.skipToEnd();
			return 'section';
		}

		const metadata = line.match(/^(\s*>>\s*[^:]*:)(.*)$/u);
		if (metadata) {
			stream.pos += metadata[1].length;
			state.metadataValue = true;
			return 'metadataKey';
		}

		if (/^\s*>>/u.test(line)) {
			stream.skipToEnd();
			return 'metadataKey';
		}
	}

	if (state.frontmatter || state.metadataValue) {
		stream.skipToEnd();
		return state.frontmatter ? 'frontmatter' : 'metadataValue';
	}

	// `{...}` and `(...)` style according to the entity they belong to.
	if (state.afterEntity) {
		const kind = state.entityTrigger;

		if (stream.peek() === '{') {
			stream.match(BRACES);
			// A note may follow the quantity, so keep the flag one more step.
			return entityQuantityToken(kind);
		}

		if (stream.peek() === '(') {
			state.afterEntity = false;
			stream.match(PARENS);
			return 'note';
		}

		state.afterEntity = false;
	}

	if (stream.match(/^\\[\s\S]/u)) return null;

	if (stream.match('--')) {
		stream.skipToEnd();
		return 'comment';
	}

	const trigger = stream.peek();
	if (trigger && ENTITY_TRIGGERS.has(trigger)) {
		// A multi-word name is only legal with braces, so when a `{` follows
		// (and no sentence punctuation comes first) everything up to it is the
		// name. Otherwise the name is a single word.
		if (!stream.match(/^[@#~][^@#~{}()[\].,;:!?]+(?=\{)/u)) {
			stream.match(/^[@#~][^\s@#~{}()[\].,;:!?]*/u);
		}

		state.afterEntity = true;
		state.entityTrigger = trigger as StreamState['entityTrigger'];
		return entityNameToken(trigger);
	}

	// Ordinary prose: take a whole run in one call.
	if (stream.match(/^(?:(?!--)[^@#~\\]|\\[\s\S])+/u)) return null;

	stream.next();
	return null;
}

/**
 * Token colours. The custom tags let ingredient, cookware and timer keep their
 * own colour for both name and quantity, matching the textarea overlay.
 */
const ingredientTag = Tag.define();
const ingredientQuantityTag = Tag.define();
const cookwareTag = Tag.define();
const cookwareQuantityTag = Tag.define();
const timerTag = Tag.define();
const timerQuantityTag = Tag.define();

export const cooklangLanguage = StreamLanguage.define({
	name: 'cooklang',
	startState,
	token,
	tokenTable: {
		ingredient: ingredientTag,
		ingredientQuantity: ingredientQuantityTag,
		cookware: cookwareTag,
		cookwareQuantity: cookwareQuantityTag,
		timer: timerTag,
		timerQuantity: timerQuantityTag,
		comment: tags.comment,
		section: tags.heading,
		metadataKey: tags.propertyName,
		metadataValue: tags.string,
		frontmatterKey: tags.propertyName,
		frontmatter: tags.string,
		frontmatterDelimiter: tags.meta,
		note: tags.emphasis
	}
});

/** Highlight style built from the app's role variables, so it follows the theme. */
export const cooklangHighlightStyle = HighlightStyle.define([
	{ tag: tags.comment, color: 'var(--color-fg-subtle)', fontStyle: 'italic' },
	{ tag: tags.heading, color: 'var(--color-fg)', fontWeight: '600' },
	{ tag: tags.propertyName, color: 'var(--color-accent2)', fontWeight: '500' },
	{ tag: tags.string, color: 'var(--color-fg-muted)' },
	{ tag: tags.meta, color: 'var(--color-fg-subtle)' },
	{ tag: tags.emphasis, color: 'var(--color-fg-subtle)', fontStyle: 'italic' },
	{ tag: ingredientTag, color: 'var(--color-accent)', fontWeight: '600' },
	{ tag: ingredientQuantityTag, color: 'var(--color-accent)', opacity: '0.75' },
	{ tag: cookwareTag, color: 'var(--color-accent2)', fontWeight: '600' },
	{ tag: cookwareQuantityTag, color: 'var(--color-accent2)', opacity: '0.75' },
	{ tag: timerTag, color: 'var(--color-warn-soft-fg)', fontWeight: '600' },
	{ tag: timerQuantityTag, color: 'var(--color-warn-soft-fg)', opacity: '0.8' }
]);

export const cooklangHighlighting = syntaxHighlighting(cooklangHighlightStyle);

export interface CompletionVocabulary {
	ingredient: readonly CompletionTerm[];
	cookware: readonly CompletionTerm[];
}

/**
 * Autocomplete source for CodeMirror. It reuses the textarea editor's context
 * detection and ranking, then applies the same `@name{}` form with the caret
 * inside the braces.
 */
export function cooklangCompletionSource(getVocabulary: () => CompletionVocabulary) {
	return (context: CMCompletionContext): CompletionResult | null => {
		const detected = detectCompletionContext(context.state.doc.toString(), context.pos);
		if (!detected) return null;

		const terms = getVocabulary()[detected.kind];
		const kind = detected.kind;
		const options = rankCompletions(terms, detected.query, 9).map((term) => ({
			label: term.name,
			type: kind,
			detail: term.count > 1 ? `${term.count}×` : undefined,
			apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
				const after = view.state.doc.sliceString(to);
				const hasBraces = after.startsWith('{');
				const inserted = `${detected.trigger}${term.name}${hasBraces ? '' : '{}'}`;

				view.dispatch({
					changes: { from, to, insert: inserted },
					selection: {
						anchor: from + detected.trigger.length + term.name.length + 1
					}
				});
			}
		}));

		return {
			from: detected.start,
			to: detected.end,
			options,
			filter: false
		};
	};
}

const DIAGNOSTIC_SEVERITY: Record<RecipeDiagnostic['severity'], Diagnostic['severity']> = {
	error: 'error',
	warning: 'warning',
	help: 'info'
};

/**
 * Turn the preview endpoint's line-based diagnostics into CodeMirror ranges.
 *
 * The whole line is underlined: the parser reports a line, not a column, and
 * guessing a narrower range would point at the wrong words once a line wraps.
 */
export function cooklangDiagnostics(
	state: EditorState,
	diagnostics: readonly RecipeDiagnostic[]
): Diagnostic[] {
	const result: Diagnostic[] = [];

	for (const diagnostic of diagnostics) {
		if (!diagnostic.line) continue;

		const lineNumber = Math.min(Math.max(diagnostic.line, 1), state.doc.lines);
		const line = state.doc.line(lineNumber);

		result.push({
			from: line.from,
			to: line.to,
			severity: DIAGNOSTIC_SEVERITY[diagnostic.severity] ?? 'info',
			message: diagnostic.message,
			source: 'Cooklang'
		});
	}

	return result;
}
