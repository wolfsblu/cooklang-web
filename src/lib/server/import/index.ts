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
import { AiRequestError, chatCompletion, type ChatMessage } from '../ai/client.js';
import { aiConfig } from '../ai/config.js';
import { buildImportMessages } from '../ai/prompt.js';
import { extractRecipe } from './extract.js';
import { fetchRecipePage } from './fetch.js';
import { cleanModelOutput, ensureFrontmatter, stripRedundantAmounts } from './output.js';
import { canonicalizeIngredientNames } from '../recipes/ingredients.js';
import { previewRecipe, RecipeSourceError } from '../recipes/parse.js';

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

export class RecipeImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RecipeImportError';
	}
}

const PARSE_FAILURE =
	'The model produced text the Cooklang parser could not read. Try importing again, perhaps from a more structured recipe page.';

function hasUsableShape(preview: RecipePreview): boolean {
	if (preview.display.ingredients.length === 0) return false;
	return preview.display.sections.some((section) =>
		section.content.some((content) => content.type === 'step')
	);
}

function parseOrThrow(source: string, fallbackTitle: string): RecipePreview {
	try {
		const preview = previewRecipe(source, fallbackTitle);
		if (!hasUsableShape(preview)) {
			throw new RecipeSourceError('The generated recipe has no ingredients or steps.');
		}
		return preview;
	} catch (error) {
		if (error instanceof RecipeSourceError) throw error;
		throw new RecipeSourceError(
			error instanceof Error ? error.message : 'The generated recipe could not be parsed.'
		);
	}
}

function retryMessages(
	original: readonly ChatMessage[],
	firstAttempt: string,
	problem: string
): ChatMessage[] {
	return [
		...original,
		{ role: 'assistant', content: firstAttempt },
		{
			role: 'user',
			content: `That Cooklang source was rejected: ${problem}\n\nReturn the corrected recipe. Output only Cooklang, with a YAML frontmatter block, at least one ingredient and at least one method step. Do not explain the correction.`
		}
	];
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

	const messages = buildImportMessages(extracted, vocabulary);
	let raw = await chatCompletion(messages);
	let source = stripRedundantAmounts(
		ensureFrontmatter(cleanModelOutput(raw), extracted.title, page.url)
	);
	let canonical = canonicalizeIngredientNames(source, vocabulary);
	source = canonical.source;

	let preview: RecipePreview;
	try {
		preview = parseOrThrow(source, extracted.title);
	} catch (error) {
		const problem =
			error instanceof RecipeSourceError ? error.message : 'The Cooklang could not be parsed.';

		// One corrective pass is cheap relative to asking the user to start
		// over, and one is enough to catch the common fenced/malformed output.
		try {
			raw = await chatCompletion(retryMessages(messages, raw, problem));
			source = stripRedundantAmounts(
				ensureFrontmatter(cleanModelOutput(raw), extracted.title, page.url)
			);
			canonical = canonicalizeIngredientNames(source, vocabulary);
			source = canonical.source;
			preview = parseOrThrow(source, extracted.title);
		} catch (retryError) {
			throw new RecipeImportError(
				retryError instanceof AiRequestError
					? retryError.message
					: retryError instanceof RecipeSourceError
						? `${PARSE_FAILURE} (${retryError.message})`
						: retryError instanceof RecipeImportError
							? retryError.message
							: PARSE_FAILURE
			);
		}
	}

	const title = preview.display.title?.trim() || extracted.title || 'Imported recipe';

	return {
		source,
		title,
		preview,
		sourceUrl: page.url,
		imageUrl: extracted.imageUrl,
		suggestedName: title,
		matches: canonical.matches,
		structured: extracted.structured,
		model: aiConfig.model
	};
}
