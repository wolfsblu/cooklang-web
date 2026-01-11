/**
 * Clear shopping list API endpoint
 * POST: Delete all recipes from the shopping list
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearShoppingListFile } from '$lib/cooklang/persistence.js';

/**
 * Clear all recipes from the shopping list
 */
export const POST: RequestHandler = async () => {
	try {
		await clearShoppingListFile();

		return json({
			success: true,
			recipes: []
		});
	} catch (err) {
		console.error('Failed to clear shopping list:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to clear shopping list'
		});
	}
};
