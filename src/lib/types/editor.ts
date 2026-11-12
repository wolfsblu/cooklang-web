import type { RecipeDisplay } from './recipe';

/** Where a completion was triggered from in the source. */
export type CompletionKind = 'ingredient' | 'cookware';

/**
 * One autocomplete candidate.
 *
 * `count` is how often the name appears across the library. It only breaks
 * ties between equally good textual matches, but it puts the ingredients a
 * cook actually uses near the top of an empty completion menu.
 */
export interface CompletionTerm {
	name: string;
	count: number;
}

export interface EditorVocabulary {
	ingredients: CompletionTerm[];
	cookware: CompletionTerm[];
}

export type DiagnosticSeverity = 'warning' | 'error' | 'help';

/** A single parser diagnostic, extracted from the Cooklang report. */
export interface RecipeDiagnostic {
	severity: DiagnosticSeverity;
	message: string;
	/** 1-based source line, when the report points at one. */
	line: number | null;
}

/** What the live preview endpoint returns, and what the editor renders. */
export interface RecipePreview {
	display: RecipeDisplay;
	diagnostics: RecipeDiagnostic[];
}
