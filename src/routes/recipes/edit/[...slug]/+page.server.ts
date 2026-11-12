import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getEntry, getIndex, invalidateRecipe } from '$lib/server/recipes/index.js';
import {
	failedPreview,
	invalidateRecipeDisplay,
	previewRecipe,
	RecipeSourceError
} from '$lib/server/recipes/parse.js';
import { buildVocabulary } from '$lib/server/recipes/vocabulary.js';
import {
	readRecipeSource,
	RecipeConflictError,
	saveRecipeSource
} from '$lib/server/recipes/write.js';

/** Generous for a recipe, small enough that a paste cannot tie up the parser. */
const MAX_SOURCE_LENGTH = 512 * 1024;

const PARSE_ERROR =
	'The Cooklang parser could not read this recipe. Check for an unclosed brace or malformed metadata.';

export const load: PageServerLoad = async ({ params }) => {
	const entry = await getEntry(params.slug);
	if (!entry) throw error(404, 'Recipe not found');

	let source: string;
	let mtimeMs: number;

	try {
		({ source, mtimeMs } = await readRecipeSource(entry));
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error(404, 'Recipe file not found');
		}

		console.error(`Failed to read recipe "${entry.relPath}":`, err);
		throw error(500, 'The recipe could not be read');
	}

	const index = await getIndex();

	let preview;
	try {
		preview = previewRecipe(source, entry.title);
	} catch (err) {
		console.error(`Failed to parse recipe "${entry.relPath}" for the editor:`, err);
		preview = failedPreview(
			entry.title,
			err instanceof RecipeSourceError ? err.message : PARSE_ERROR,
			err instanceof RecipeSourceError ? err.line : null
		);
	}

	return {
		slug: entry.slug,
		relPath: entry.relPath,
		title: entry.title,
		source,
		mtimeMs,
		vocabulary: buildVocabulary(index.entries),
		// Parsed once for first paint. The client re-parses on a debounce after
		// that, but the preview should never flash empty when it already has a
		// perfectly good recipe to show.
		preview
	};
};

function formString(data: FormData, key: string): string | null {
	const value = data.get(key);
	return typeof value === 'string' ? value : null;
}

export const actions: Actions = {
	save: async ({ request, params }) => {
		const entry = await getEntry(params.slug);
		if (!entry) return fail(404, { message: 'Recipe not found' });

		const data = await request.formData();
		const source = formString(data, 'source');

		if (source === null) {
			return fail(400, { message: 'No recipe text was submitted' });
		}

		if (!source.trim()) {
			return fail(400, { message: 'A recipe cannot be saved empty' });
		}

		if (source.length > MAX_SOURCE_LENGTH) {
			return fail(413, { message: 'This recipe is too large to save' });
		}

		const expected = Number(formString(data, 'expectedMtime'));
		if (!Number.isFinite(expected)) {
			return fail(400, { message: 'Missing the file version to save against' });
		}

		try {
			const mtimeMs = await saveRecipeSource(entry, source, expected);

			// The index and detail-render caches are stat-keyed, and a save inside
			// one timestamp tick can leave the mtime unchanged. Clear both entries
			// explicitly so the next page load sees this text.
			invalidateRecipe(entry.relPath);
			invalidateRecipeDisplay(entry.slug);

			// No preview in the action response: the editor already has a live
			// preview, and re-parsing here could panic on text the user is still
			// half-way through writing, after the file has already been saved.
			return {
				success: true,
				mtimeMs
			};
		} catch (err) {
			if (err instanceof RecipeConflictError) {
				return fail(409, {
					message:
						'This recipe changed on disk since you opened it. Reload the editor to get the latest version, then make your changes again.',
					conflict: true
				});
			}

			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				return fail(409, {
					message: 'The recipe file no longer exists on disk.',
					conflict: true
				});
			}

			if (['EACCES', 'EPERM', 'EROFS'].includes((err as NodeJS.ErrnoException).code ?? '')) {
				return fail(500, {
					message:
						'The recipe directory is not writable. Check the mount and container permissions.'
				});
			}

			console.error(`Failed to save recipe "${entry.relPath}":`, err);
			return fail(500, { message: 'The recipe could not be saved. Please try again.' });
		}
	}
};
