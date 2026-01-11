/**
 * Shopping list recipe management API endpoints
 * POST: Add or update a recipe in the shopping list
 * DELETE: Remove a recipe from the shopping list
 * PUT: Update recipe scale
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	addRecipeToFile,
	removeRecipeFromFile,
	updateRecipeScale
} from '$lib/cooklang/persistence.js';
import type { RecipeSelection } from '$lib/types/shopping-list.js';

/**
 * Add or update a recipe in the shopping list
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Partial<RecipeSelection>;

		// Validate required fields
		if (!body.slug || typeof body.slug !== 'string') {
			throw error(400, { message: 'Missing or invalid required field: slug' });
		}

		if (!body.title || typeof body.title !== 'string') {
			throw error(400, { message: 'Missing or invalid required field: title' });
		}

		if (typeof body.scale !== 'number' || body.scale <= 0) {
			throw error(400, { message: 'Invalid scale value: must be a positive number' });
		}

		// Create recipe selection
		const recipe: RecipeSelection = {
			slug: body.slug,
			title: body.title,
			scale: body.scale,
			servings: body.servings,
			imageUrl: body.imageUrl
		};

		// Add or update in file
		const recipes = await addRecipeToFile(recipe);

		return json({ recipes });
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Failed to add recipe to shopping list:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to add recipe to shopping list'
		});
	}
};

/**
 * Remove a recipe from the shopping list
 */
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { slug?: string };

		// Validate required fields
		if (!body.slug || typeof body.slug !== 'string') {
			throw error(400, { message: 'Missing or invalid required field: slug' });
		}

		// Remove from file
		const recipes = await removeRecipeFromFile(body.slug);

		return json({ recipes });
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Failed to remove recipe from shopping list:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to remove recipe from shopping list'
		});
	}
};

/**
 * Update recipe scale
 */
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { slug?: string; scale?: number };

		// Validate required fields
		if (!body.slug || typeof body.slug !== 'string') {
			throw error(400, { message: 'Missing or invalid required field: slug' });
		}

		if (typeof body.scale !== 'number' || body.scale <= 0) {
			throw error(400, { message: 'Invalid scale value: must be a positive number' });
		}

		// Update scale in file
		const recipes = await updateRecipeScale(body.slug, body.scale);

		return json({ recipes });
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Failed to update recipe scale:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to update recipe scale'
		});
	}
};
