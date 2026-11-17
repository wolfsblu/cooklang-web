/**
 * Photo -> Cooklang import pipeline.
 *
 *   1. validate the uploaded image (the browser has already downscaled it)
 *   2. inline it as a data URL and ask the vision model for Cooklang
 *   3. clean, validate and canonicalise the result like a URL import
 *
 * Nothing is written to disk here. The review page decides whether the same
 * photo should become the recipe's cover image.
 */

import type { CompletionTerm, RecipePreview } from '#lib/types/editor.js';
import type { IngredientMatch } from '#lib/types/import.js';
import { aiVisionConfig, isVisionConfigured } from '../ai/config.js';
import { buildPhotoImportMessages } from '../ai/prompt.js';
import { RecipeImportError } from './errors.js';
import { generateRecipeFromMessages } from './generate.js';
import {
	detectPhotoImage,
	MAX_PHOTO_BYTES,
	photoDataUrl,
	photoFormatMessage
} from './image-data.js';

export interface ImportedPhotoRecipe {
	source: string;
	title: string;
	preview: RecipePreview;
	suggestedName: string;
	matches: IngredientMatch[];
	model: string;
}

const NO_RECIPE_IN_PHOTO =
	'No recipe text could be read from that photo. Try a sharper picture that shows the ingredients and method.';

export async function importRecipeFromPhoto(
	bytes: Uint8Array,
	vocabulary: readonly CompletionTerm[]
): Promise<ImportedPhotoRecipe> {
	if (!isVisionConfigured()) {
		throw new RecipeImportError(
			'Photo import is not configured. Set AI_VISION_MODEL to a vision-capable model and restart the app.'
		);
	}

	if (bytes.length === 0) {
		throw new RecipeImportError('That photo is empty.');
	}

	if (bytes.length > MAX_PHOTO_BYTES) {
		throw new RecipeImportError('Photos must be 20 MB or smaller.');
	}

	const detected = detectPhotoImage(bytes);
	if (!detected) {
		throw new RecipeImportError(photoFormatMessage(bytes));
	}

	const messages = buildPhotoImportMessages(vocabulary, photoDataUrl(bytes, detected.mimeType));

	const generated = await generateRecipeFromMessages({
		messages,
		vocabulary,
		fallbackTitle: 'Recipe from photo',
		sourceUrl: null,
		chatOptions: {
			model: aiVisionConfig.model,
			apiKey: aiVisionConfig.apiKey,
			baseUrl: aiVisionConfig.baseUrl
		},
		noRecipeMessage: NO_RECIPE_IN_PHOTO
	});

	const title = generated.preview.display.title?.trim() || 'Recipe from photo';

	return {
		source: generated.source,
		title,
		preview: generated.preview,
		suggestedName: title,
		matches: generated.matches,
		model: aiVisionConfig.model
	};
}
