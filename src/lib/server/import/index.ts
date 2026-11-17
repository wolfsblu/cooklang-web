/**
 * URL -> Cooklang import pipeline.
 *
 *   1. fetch the public page
 *   2. pull recipe data out of its JSON-LD (or visible text)
 *   3. ask the model for Cooklang, with the library's ingredient vocabulary
 *   4. clean and validate the result, retrying once on a parse failure
 *   5. canonicalise ingredient spellings and hand back a preview
 *
 * Nothing is written to disk here. The import page shows the result for review
 * and the create action is a separate, explicit step.
 */

import type { CompletionTerm, RecipePreview } from '#lib/types/editor.js';
import type { IngredientMatch } from '#lib/types/import.js';
import { aiConfig } from '../ai/config.js';
import { buildImportMessages } from '../ai/prompt.js';
import { RecipeImportError } from './errors.js';
import { extractRecipe } from './extract.js';
import { fetchRecipePage } from './fetch.js';
import { generateRecipeFromMessages } from './generate.js';

export { RecipeImportError } from './errors.js';

export interface ImportedRecipe {
	source: string;
	title: string;
	preview: RecipePreview;
	sourceUrl: string;
	imageUrl: string | null;
	suggestedName: string;
	matches: IngredientMatch[];
	structured: boolean;
	model: string;
}

export async function importRecipeFromUrl(
	url: string,
	vocabulary: readonly CompletionTerm[]
): Promise<ImportedRecipe> {
	const page = await fetchRecipePage(url);
	const extracted = extractRecipe(page.html, page.url);

	if (extracted.ingredients.length === 0 && (extracted.rawText?.length ?? 0) < 100) {
		throw new RecipeImportError(
			'No recipe could be found on that page. Check the URL, or try a page that shows the ingredients and method.'
		);
	}

	const generated = await generateRecipeFromMessages({
		messages: buildImportMessages(extracted, vocabulary),
		vocabulary,
		fallbackTitle: extracted.title,
		sourceUrl: page.url
	});

	const title = generated.preview.display.title?.trim() || extracted.title || 'Imported recipe';

	return {
		source: generated.source,
		title,
		preview: generated.preview,
		sourceUrl: page.url,
		imageUrl: extracted.imageUrl,
		suggestedName: title,
		matches: generated.matches,
		structured: extracted.structured,
		model: aiConfig.model
	};
}
