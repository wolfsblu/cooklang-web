import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEntry, invalidateRecipe } from '$lib/server/recipes/index.js';
import { clampScale, getRecipeDisplay } from '$lib/server/recipes/parse.js';
import { imageRef } from '$lib/server/images.js';
import {
	detectImageType,
	isHeif,
	MAX_IMAGE_BYTES,
	removeRecipeImage,
	writeRecipeImage
} from '$lib/server/recipes/image.js';
import { readSelections } from '$lib/server/shopping/store.js';

export const load: PageServerLoad = async ({ params, url }) => {
	// The slug is looked up in the index rather than joined onto a path. Nothing
	// a visitor types reaches the filesystem, so "../.." resolves to a 404 here
	// instead of reading an arbitrary file as the previous route did.
	const entry = await getEntry(params.slug);
	if (!entry) {
		throw error(404, 'Recipe not found');
	}

	const scale = clampScale(url.searchParams.get('scale'));
	const [recipe, selections] = await Promise.all([
		getRecipeDisplay(entry, scale),
		readSelections()
	]);

	// Membership is resolved here rather than in a client store, so the button
	// is correct on first paint instead of always reading "Add".
	const selection = selections.find((s) => s.slug === entry.slug);

	return {
		recipe,
		// The parser scales the servings metadata along with the quantities, so
		// `recipe.servings` is the scaled figure, not what the file declares. The
		// index parses unscaled, so its copy is the base the control needs -- ask
		// the scaled one and every edit compounds the scale it already applied.
		baseServings: entry.servings,
		inShoppingList: selection !== undefined,
		listedScale: selection?.scale ?? null,
		image: imageRef(entry.image, 'hero'),
		stepImages: Object.fromEntries(
			Object.entries(entry.stepImages).map(([step, image]) => [step, imageRef(image, 'step')])
		),
		scale,
		slug: entry.slug,
		relPath: entry.relPath
	};
};

/** A filesystem failure the whole library volume would share, phrased for the UI. */
function imageWriteFailure(err: unknown) {
	const code = (err as NodeJS.ErrnoException).code ?? '';

	if (['EACCES', 'EPERM', 'EROFS'].includes(code)) {
		return fail(500, {
			message: 'The recipe directory is not writable. Check the mount and container permissions.'
		});
	}

	if (code === 'ENOSPC') {
		return fail(500, { message: 'The recipe volume is full, so the image could not be saved.' });
	}

	console.error('Failed to update a recipe image:', err);
	return fail(500, { message: 'The image could not be saved. Please try again.' });
}

export const actions: Actions = {
	/** Replace or add the cover image beside the recipe file. */
	updateImage: async ({ request, params }) => {
		const entry = await getEntry(params.slug);
		if (!entry) return fail(404, { message: 'Recipe not found' });

		const data = await request.formData();
		const upload = data.get('image');
		if (!(upload instanceof File)) {
			return fail(400, { message: 'Choose an image to upload' });
		}

		if (upload.size === 0) {
			return fail(400, { message: 'That image is empty' });
		}

		if (upload.size > MAX_IMAGE_BYTES) {
			return fail(413, { message: 'Images must be 20 MB or smaller' });
		}

		let bytes: Uint8Array;
		try {
			bytes = new Uint8Array(await upload.arrayBuffer());
		} catch {
			return fail(400, { message: 'The image could not be read. Please choose it again.' });
		}

		// Sniff the bytes rather than trusting the filename or the browser's
		// content type, both of which the client controls.
		const detected = detectImageType(bytes);
		if (!detected) {
			return fail(415, {
				message: isHeif(bytes)
					? 'HEIC and HEIF photos cannot be stored directly. Export the photo as a JPEG and upload that.'
					: 'Choose a JPEG, PNG or WebP image'
			});
		}

		try {
			await writeRecipeImage(entry, bytes, detected.extension);

			// The index caches image mtimes. Drop the entry so the page reload
			// that follows the action picks up the new file and cache-busts it.
			invalidateRecipe(entry.relPath);
			return { success: true };
		} catch (err) {
			return imageWriteFailure(err);
		}
	},

	/** Delete the cover image. Step photos are left alone. */
	removeImage: async ({ params }) => {
		const entry = await getEntry(params.slug);
		if (!entry) return fail(404, { message: 'Recipe not found' });

		try {
			await removeRecipeImage(entry);
			invalidateRecipe(entry.relPath);
			return { success: true };
		} catch (err) {
			return imageWriteFailure(err);
		}
	}
};
