import type { RecipePreview } from './editor.js';

/** One ingredient the importer rewrote to an existing library spelling. */
export interface IngredientMatch {
	from: string;
	to: string;
}

/** Successful response from the import form action. */
export interface ImportedRecipeDraft {
	ok: true;
	source: string;
	title: string;
	preview: RecipePreview;
	sourceUrl: string;
	/** Remote cover image found on the page, if any. */
	imageUrl: string | null;
	/** Filename stem suggested from the title. */
	suggestedName: string;
	matches: IngredientMatch[];
	/** Whether the page published JSON-LD recipe data. */
	structured: boolean;
	model: string;
}

/** Failure response from the import form action. */
export interface ImportFailure {
	message: string;
}
