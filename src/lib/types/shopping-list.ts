/**
 * Frontend type definitions for shopping list feature
 */

/**
 * Recipe selection for shopping list
 */
export interface RecipeSelection {
	slug: string; // "Easy Pancakes.cook"
	title: string; // "Easy Pancakes" (for display)
	scale: number; // 1.0, 2.0, etc.
	servings?: number; // Original servings (for display)
	imageUrl?: string; // Recipe image URL (for display)
}

/**
 * Shopping list item (single ingredient)
 */
export interface ShoppingListItem {
	name: string; // "flour" (lowercase, internal)
	displayName: string; // "Flour" (capitalized, for display)
	quantity: string | null; // "250 g" or "2 cups and 1 tsp" or null
}

/**
 * Shopping list category (e.g., "Produce", "Dairy")
 */
export interface ShoppingListCategory {
	name: string; // "produce", "other" (lowercase, internal)
	displayName: string; // "Produce", "Other" (capitalized, for display)
	items: ShoppingListItem[];
}

/**
 * Complete shopping list display data
 */
export interface ShoppingListDisplay {
	categories: ShoppingListCategory[];
	recipeCount: number;
	totalItems: number;
}

/**
 * Shopping list store state
 */
export interface ShoppingListState {
	selectedRecipes: RecipeSelection[];
	shoppingList: ShoppingListDisplay | null;
	loading: boolean;
	error: string | null;
}
