/**
 * Type definitions for Cook CLI JSON output
 * Based on the output from: cook shopping-list recipe.cook -f json
 */

/**
 * Quantity value types from Cook CLI
 */
export interface CookCLIQuantityValue {
	type: 'number' | 'text' | 'range';
	value: number | string | { from: number; to: number };
}

/**
 * Quantity structure from Cook CLI
 */
export interface CookCLIQuantity {
	unit: string | null;
	value: CookCLIQuantityValue;
}

/**
 * Shopping list item from Cook CLI
 */
export interface CookCLIShoppingItem {
	name: string;
	quantity: CookCLIQuantity[]; // Can have multiple quantities (e.g., 2 cups and 1 tsp)
}

/**
 * Shopping list category from Cook CLI
 */
export interface CookCLIShoppingCategory {
	category: string; // e.g., "produce", "dairy", "other"
	items: CookCLIShoppingItem[];
}

/**
 * Complete shopping list output from Cook CLI
 */
export type CookCLIShoppingList = CookCLIShoppingCategory[];
