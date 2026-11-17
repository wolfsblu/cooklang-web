/**
 * Turn model output into reviewed Cooklang source.
 *
 * Both import paths -- a fetched page and an uploaded photo -- converge here:
 * ask the model, clean its wrapper, guarantee the frontmatter, canonicalise
 * ingredient spellings, then parse. A single corrective pass catches the
 * common fenced or malformed output; asking the user to start over for that
 * would be a poor trade.
 */

import type { CompletionTerm, RecipePreview } from '#lib/types/editor.js';
import type { IngredientMatch } from '#lib/types/import.js';
import {
	AiRequestError,
	chatCompletion,
	type ChatMessage,
	type ChatOptions
} from '../ai/client.js';
import { canonicalizeIngredientNames } from '../recipes/ingredients.js';
import { previewRecipe, RecipeSourceError } from '../recipes/parse.js';
import { RecipeImportError } from './errors.js';
import { cleanModelOutput, ensureFrontmatter, stripRedundantAmounts } from './output.js';

/** Injectable completion function, so the retry path is testable without a provider. */
export type ChatCompletionFn = (
	messages: readonly ChatMessage[],
	options?: ChatOptions
) => Promise<string>;

export interface GeneratedRecipe {
	source: string;
	preview: RecipePreview;
	matches: IngredientMatch[];
}

export interface GenerateRecipeOptions {
	messages: readonly ChatMessage[];
	vocabulary: readonly CompletionTerm[];
	fallbackTitle: string;
	/** `null` for uploads, which have no page to cite. */
	sourceUrl: string | null;
	/** Provider overrides, e.g. the vision model for a photo import. */
	chatOptions?: ChatOptions;
	/** Shown instead of the generic parser message when the model finds no recipe. */
	noRecipeMessage?: string;
	/** Test seam. Defaults to the real provider client. */
	chat?: ChatCompletionFn;
}

const PARSE_FAILURE =
	'The model produced text the Cooklang parser could not read. Try importing again, perhaps from a more structured recipe page.';

const NO_RECIPE_FOUND = 'No recipe could be found in the provided source.';

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

function normalise(raw: string, fallbackTitle: string, sourceUrl: string | null): string {
	return stripRedundantAmounts(ensureFrontmatter(cleanModelOutput(raw), fallbackTitle, sourceUrl));
}

/** The model reports an unreadable image with a sentinel instead of fake content. */
function isNoRecipeOutput(raw: string): boolean {
	return /^NO_RECIPE\b/iu.test(cleanModelOutput(raw).trim());
}

export async function generateRecipeFromMessages({
	messages,
	vocabulary,
	fallbackTitle,
	sourceUrl,
	chatOptions,
	noRecipeMessage = NO_RECIPE_FOUND,
	chat = chatCompletion
}: GenerateRecipeOptions): Promise<GeneratedRecipe> {
	const complete = (next: readonly ChatMessage[]) => chat(next, chatOptions);

	let raw = await complete(messages);
	if (isNoRecipeOutput(raw)) throw new RecipeImportError(noRecipeMessage);

	let source = normalise(raw, fallbackTitle, sourceUrl);
	let canonical = canonicalizeIngredientNames(source, vocabulary);
	source = canonical.source;

	let preview: RecipePreview;
	try {
		preview = parseOrThrow(source, fallbackTitle);
	} catch (error) {
		const problem =
			error instanceof RecipeSourceError ? error.message : 'The Cooklang could not be parsed.';

		try {
			raw = await complete(retryMessages(messages, raw, problem));
			if (isNoRecipeOutput(raw)) throw new RecipeImportError(noRecipeMessage);

			source = normalise(raw, fallbackTitle, sourceUrl);
			canonical = canonicalizeIngredientNames(source, vocabulary);
			source = canonical.source;
			preview = parseOrThrow(source, fallbackTitle);
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

	return { source, preview, matches: canonical.matches };
}
