/**
 * Pantry data as it crosses the server/client boundary.
 *
 * The parser lives under `$lib/server` and cannot be imported by a component,
 * so the shared model lives here instead of inside the parser module.
 */

/** A single stocked (or remembered) item, as written in pantry.conf. */
export interface PantryItem {
	name: string;
	section: string;
	/** Raw cooklang quantity, e.g. "500%g" or "6". Null when only presence matters. */
	quantity: string | null;
	/** Threshold below which the item counts as running low. */
	low: string | null;
	bought: string | null;
	expire: string | null;
	/** True for `# name = "..."` entries: remembered, but not in stock. */
	disabled: boolean;
}

/** A pantry item with the derived display fields the table renders. */
export interface PantryItemView extends PantryItem {
	displayQuantity: string | null;
	runningLow: boolean;
	expiringSoon: boolean;
	daysLeft: number | null;
	/**
	 * Numeric amount for sorting the quantity column. Computed on the server
	 * because the parser lives under `$lib/server`. Units are deliberately
	 * ignored: sorting is a within-column convenience, not the meaningful
	 * comparison that compareQuantities refuses to fake.
	 */
	sortAmount: number | null;
}
