import type { RecipePreview } from './editor.js';

/** Where an imported recipe came from. */
export type ImportSourceKind = 'url' | 'photo';

/** One ingredient the importer rewrote to an existing library spelling. */
export interface IngredientMatch {
	from: string;
	to: string;
}

/** Successful response from the import form action. */
export interface ImportedRecipeDraft {
	ok: true;
	sourceKind: ImportSourceKind;
	source: string;
	title: string;
	preview: RecipePreview;
	/** Source page for URL imports; `null` for photo imports. */
	sourceUrl: string | null;
	/** Remote cover image found on the page, if any. */
	imageUrl: string | null;
	/** Uploaded file name for photo imports. */
	photoName: string | null;
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
