import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { AiRequestError } from '#lib/server/ai/client.js';
import {
	aiConfig,
	aiVisionConfig,
	isAiConfigured,
	isVisionConfigured
} from '#lib/server/ai/config.js';
import { fetchRecipeImage } from '#lib/server/import/fetch.js';
import { importRecipeFromUrl, RecipeImportError } from '#lib/server/import/index.js';
import { importRecipeFromPhoto } from '#lib/server/import/photo.js';
import { ImportUrlError } from '#lib/server/import/url.js';
import { createRecipe, RecipeCreateError } from '#lib/server/recipes/create.js';
import {
	detectImageType,
	isHeif,
	MAX_IMAGE_BYTES,
	writeRecipeImage
} from '#lib/server/recipes/image.js';
import { getEntry, getIndex, invalidateRecipe } from '#lib/server/recipes/index.js';
import { previewRecipe, RecipeSourceError } from '#lib/server/recipes/parse.js';
import { buildVocabulary } from '#lib/server/recipes/vocabulary.js';
import type { ImportFailure, ImportedRecipeDraft } from '#lib/types/import.js';
import { setFrontmatterTitle } from '#lib/utils/cooklang-title.js';

const MAX_URL_LENGTH = 2_048;
const MAX_SOURCE_LENGTH = 512 * 1024;

function formString(data: FormData, key: string): string {
	const value = data.get(key);
	return typeof value === 'string' ? value : '';
}

function foldersFromPaths(relPaths: readonly string[]): string[] {
	const folders = new Set<string>();

	for (const relPath of relPaths) {
		const slash = relPath.lastIndexOf('/');
		if (slash <= 0) continue;
		const folder = relPath.slice(0, slash);
		if (folder) folders.add(folder);
	}

	return [...folders].sort((a, b) => a.localeCompare(b));
}

export const load: PageServerLoad = async () => {
	const index = await getIndex();

	return {
		aiConfigured: isAiConfigured(),
		aiModel: aiConfig.model,
		visionConfigured: isVisionConfigured(),
		visionModel: aiVisionConfig.model || null,
		vocabulary: buildVocabulary(index.entries),
		folders: foldersFromPaths(index.entries.map((entry) => entry.relPath))
	};
};

export const actions: Actions = {
	import: async ({ request }) => {
		const data = await request.formData();
		const url = formString(data, 'url').trim();

		if (!url) {
			return fail(400, { message: 'Enter the URL of a recipe page.' } satisfies ImportFailure);
		}

		if (url.length > MAX_URL_LENGTH) {
			return fail(400, { message: 'That URL is too long.' } satisfies ImportFailure);
		}

		if (!isAiConfigured()) {
			return fail(503, {
				message:
					'AI import is not configured. Set AI_API_KEY (and optionally AI_BASE_URL and AI_MODEL), then restart the app.'
			} satisfies ImportFailure);
		}

		try {
			const index = await getIndex();
			const imported = await importRecipeFromUrl(url, buildVocabulary(index.entries).ingredients);

			return {
				ok: true,
				sourceKind: 'url',
				photoName: null,
				...imported
			} satisfies ImportedRecipeDraft;
		} catch (error) {
			if (
				error instanceof RecipeImportError ||
				error instanceof ImportUrlError ||
				error instanceof AiRequestError
			) {
				return fail(422, { message: error.message } satisfies ImportFailure);
			}

			console.error('Recipe import failed:', error);
			return fail(500, {
				message: 'The recipe could not be imported. Try again or check the server log.'
			} satisfies ImportFailure);
		}
	},

	importPhoto: async ({ request }) => {
		if (!isVisionConfigured()) {
			return fail(503, {
				message:
					'Photo import is not configured. Set AI_VISION_MODEL to a vision-capable model (and AI_VISION_BASE_URL/AI_VISION_API_KEY when it is not the text provider), then restart the app.'
			} satisfies ImportFailure);
		}

		const data = await request.formData();
		const upload = data.get('image');

		if (!(upload instanceof File) || upload.size === 0) {
			return fail(400, { message: 'Choose a photo of a recipe first.' } satisfies ImportFailure);
		}

		if (upload.size > MAX_IMAGE_BYTES) {
			return fail(413, {
				message: 'Photos must be 20 MB or smaller.'
			} satisfies ImportFailure);
		}

		let bytes: Uint8Array;
		try {
			bytes = new Uint8Array(await upload.arrayBuffer());
		} catch {
			return fail(400, {
				message: 'The photo could not be read. Please choose it again.'
			} satisfies ImportFailure);
		}

		try {
			const index = await getIndex();
			const imported = await importRecipeFromPhoto(
				bytes,
				buildVocabulary(index.entries).ingredients
			);

			return {
				ok: true,
				sourceKind: 'photo',
				sourceUrl: null,
				imageUrl: null,
				structured: false,
				photoName: upload.name || 'Photo',
				...imported
			} satisfies ImportedRecipeDraft;
		} catch (error) {
			if (error instanceof RecipeImportError || error instanceof AiRequestError) {
				return fail(422, { message: error.message } satisfies ImportFailure);
			}

			console.error('Photo import failed:', error);
			return fail(500, {
				message: 'The photo could not be imported. Try again or check the server log.'
			} satisfies ImportFailure);
		}
	},

	create: async ({ request }) => {
		const data = await request.formData();
		const source = formString(data, 'source');
		const title = formString(data, 'title').trim();
		const filename = formString(data, 'filename').trim();
		const folder = formString(data, 'folder').trim();
		const imageUrl = formString(data, 'imageUrl').trim();
		const coverUpload = data.get('coverImage');

		if (!source.trim()) {
			return fail(400, { message: 'A recipe cannot be created empty.' } satisfies ImportFailure);
		}

		if (source.length > MAX_SOURCE_LENGTH) {
			return fail(413, { message: 'This recipe is too large to save.' } satisfies ImportFailure);
		}

		// The title field is editable in the review header. Apply it to the
		// frontmatter server-side as well, so a fast Save click cannot race the
		// blur that syncs the same value into the editor text.
		const titledSource = setFrontmatterTitle(source, title || 'Imported recipe');

		try {
			// Refuse to write a file the app cannot render. The user can still go
			// back and fix the source in the review editor.
			previewRecipe(titledSource, title || 'Imported recipe');
		} catch (error) {
			return fail(422, {
				message:
					error instanceof RecipeSourceError
						? error.message
						: 'The Cooklang source is not valid. Fix the problem before creating the recipe.'
			} satisfies ImportFailure);
		}

		let created;
		try {
			created = await createRecipe({
				title: title || 'Imported recipe',
				source: titledSource,
				filename,
				folder
			});
		} catch (error) {
			if (error instanceof RecipeCreateError) {
				return fail(400, { message: error.message } satisfies ImportFailure);
			}

			if (['EACCES', 'EPERM', 'EROFS'].includes((error as NodeJS.ErrnoException).code ?? '')) {
				return fail(500, {
					message:
						'The recipe directory is not writable. Check the mount and container permissions.'
				} satisfies ImportFailure);
			}

			console.error('Failed to create imported recipe:', error);
			return fail(500, {
				message: 'The recipe could not be created. Please try again.'
			} satisfies ImportFailure);
		}

		// A photo chosen for import can double as the cover. It was already
		// downscaled by the browser, so it is much smaller than the source file.
		if (coverUpload instanceof File && coverUpload.size > 0) {
			try {
				if (coverUpload.size > MAX_IMAGE_BYTES) {
					throw new Error('The photo is too large to use as a cover image.');
				}

				const bytes = new Uint8Array(await coverUpload.arrayBuffer());
				const detected = detectImageType(bytes);
				if (!detected) {
					throw new Error(
						isHeif(bytes)
							? 'HEIC photos cannot be stored as a cover image.'
							: 'The cover photo is not a JPEG, PNG or WebP image.'
					);
				}

				const entry = await getEntry(created.slug);
				if (!entry) throw new Error('The new recipe was not found in the index.');

				await writeRecipeImage(entry, bytes, detected.extension);
				invalidateRecipe(created.relPath);
			} catch (error) {
				// The recipe is the valuable part. A bad cover should not throw
				// away a successful import; the user can add one from the recipe
				// page, and the log records why it was skipped.
				console.warn(
					`Could not use the uploaded photo as a cover for "${created.relPath}":`,
					error
				);
			}
		} else if (imageUrl) {
			try {
				const image = await fetchRecipeImage(imageUrl);
				const entry = await getEntry(created.slug);
				if (!entry) throw new Error('The new recipe was not found in the index.');

				await writeRecipeImage(entry, image.bytes, image.extension);

				// The index was rebuilt when the recipe file landed, before the
				// image existed. Drop it again so the cover shows on the first
				// navigation rather than after the production TTL expires.
				invalidateRecipe(created.relPath);
			} catch (error) {
				// The recipe is the valuable part. A broken image URL should not
				// throw away a successful import; the user can add a cover image
				// later, and the log records why it was skipped.
				console.warn(`Could not import the image for "${created.relPath}":`, error);
			}
		}

		redirect(303, `/recipe/${created.slug}`);
	}
};
