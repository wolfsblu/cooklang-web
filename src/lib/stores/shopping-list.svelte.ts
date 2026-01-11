/**
 * Shopping list store - Svelte 5 runes-based state management
 * Syncs with server-side .shopping-list.json file via API
 */

import type { RecipeSelection, ShoppingListDisplay } from '$lib/types/shopping-list.js';

/**
 * Shopping list store state
 */
class ShoppingListStore {
	recipes = $state<RecipeSelection[]>([]);
	list = $state<ShoppingListDisplay | null>(null);
	isLoading = $state(false);
	errorMessage = $state<string | null>(null);

	/**
	 * Load shopping list from server
	 * Fetches recipe selections and generates shopping list
	 */
	async load(): Promise<void> {
		this.isLoading = true;
		this.errorMessage = null;

		try {
			const response = await fetch('/api/shopping-list');

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			this.recipes = data.recipes || [];
			this.list = data.shoppingList || null;
		} catch (err) {
			this.errorMessage = err instanceof Error ? err.message : 'Failed to load shopping list';
			console.error('Failed to load shopping list:', err);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Add or update a recipe in the shopping list
	 * @param recipe Recipe selection to add
	 */
	async addRecipe(recipe: RecipeSelection): Promise<void> {
		this.isLoading = true;
		this.errorMessage = null;

		try {
			const response = await fetch('/api/shopping-list/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(recipe)
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			this.recipes = data.recipes || [];

			// Reload to regenerate shopping list
			await this.load();
		} catch (err) {
			this.errorMessage = err instanceof Error ? err.message : 'Failed to add recipe';
			console.error('Failed to add recipe:', err);
			this.isLoading = false;
		}
	}

	/**
	 * Remove a recipe from the shopping list
	 * @param slug Recipe slug to remove
	 */
	async removeRecipe(slug: string): Promise<void> {
		this.isLoading = true;
		this.errorMessage = null;

		try {
			const response = await fetch('/api/shopping-list/recipes', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug })
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			this.recipes = data.recipes || [];

			// Reload to regenerate shopping list
			await this.load();
		} catch (err) {
			this.errorMessage = err instanceof Error ? err.message : 'Failed to remove recipe';
			console.error('Failed to remove recipe:', err);
			this.isLoading = false;
		}
	}

	/**
	 * Update the scale of a recipe
	 * @param slug Recipe slug to update
	 * @param scale New scale value
	 */
	async updateScale(slug: string, scale: number): Promise<void> {
		this.isLoading = true;
		this.errorMessage = null;

		try {
			const response = await fetch('/api/shopping-list/recipes', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug, scale })
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			this.recipes = data.recipes || [];

			// Reload to regenerate shopping list
			await this.load();
		} catch (err) {
			this.errorMessage = err instanceof Error ? err.message : 'Failed to update scale';
			console.error('Failed to update scale:', err);
			this.isLoading = false;
		}
	}

	/**
	 * Clear all recipes from the shopping list
	 */
	async clear(): Promise<void> {
		this.isLoading = true;
		this.errorMessage = null;

		try {
			const response = await fetch('/api/shopping-list/clear', {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			this.recipes = [];
			this.list = null;
		} catch (err) {
			this.errorMessage = err instanceof Error ? err.message : 'Failed to clear shopping list';
			console.error('Failed to clear shopping list:', err);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Check if a recipe is in the shopping list
	 * @param slug Recipe slug to check
	 * @returns true if recipe is in shopping list
	 */
	hasRecipe(slug: string): boolean {
		return this.recipes.some((r) => r.slug === slug);
	}

	/**
	 * Get a recipe from the shopping list
	 * @param slug Recipe slug to get
	 * @returns Recipe selection or undefined
	 */
	getRecipe(slug: string): RecipeSelection | undefined {
		return this.recipes.find((r) => r.slug === slug);
	}
}

/**
 * Global shopping list store instance
 */
export const shoppingListStore = new ShoppingListStore();
