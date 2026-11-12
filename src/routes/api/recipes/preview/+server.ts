/**
 * Live preview for the recipe editor.
 *
 * The editor sends the textarea's contents on a debounce and gets back the
 * same display model the recipe page renders, plus parser diagnostics. Keeping
 * the WASM parser on the server means the editor does not ship a second parser
 * bundle and both views are guaranteed to agree.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { previewRecipe, RecipeSourceError } from '$lib/server/recipes/parse.js';

const MAX_SOURCE_LENGTH = 512 * 1024;
const PARSE_ERROR =
	'The Cooklang parser could not read this recipe. Check for an empty name or an unclosed brace.';

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ message: 'Expected a JSON body' }, { status: 400 });
	}

	const source = (body as { source?: unknown } | null)?.source;
	const fallbackTitle = (body as { fallbackTitle?: unknown } | null)?.fallbackTitle;

	if (typeof source !== 'string') {
		return json({ message: 'The source field must be a string' }, { status: 400 });
	}

	if (source.length > MAX_SOURCE_LENGTH) {
		return json({ message: 'This recipe is too large to preview' }, { status: 413 });
	}

	const title =
		typeof fallbackTitle === 'string' && fallbackTitle.trim()
			? fallbackTitle.trim().slice(0, 200)
			: 'Untitled recipe';

	try {
		return json(previewRecipe(source, title), {
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch (error) {
		console.error('Failed to preview recipe source:', error);
		return json(
			{
				message: error instanceof RecipeSourceError ? error.message : PARSE_ERROR,
				line: error instanceof RecipeSourceError ? error.line : null
			},
			{ status: 422 }
		);
	}
};
