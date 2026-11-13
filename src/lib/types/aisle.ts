/**
 * Aisle data shared by the server stores and the presentational components.
 *
 * These used to be exported from the parser (or, worse, from a route's
 * `+page.server.ts`), which made client components import server modules just
 * for a shape.
 */

/** One ingredient line: the canonical name plus any alternative spellings. */
export interface AisleEntry {
	/**
	 * The name the CLI prints on the shopping list. Always the first field on
	 * the line -- cooklang-rs calls it the common name used in lists.
	 */
	name: string;
	/** Alternative spellings that resolve to `name`. */
	aliases: string[];
	/** Owning category. Maintained by reindex, never set by callers. */
	category: string;
	/** Trailing `// ...` text, without the slashes. Null when there is none. */
	comment: string | null;
}

/** An aisle entry with the duplicate flag the ingredients table renders. */
export interface AisleEntryView extends AisleEntry {
	/** True when this entry's name or one of its aliases is claimed twice. */
	duplicate: boolean;
}

/** A name or alias claimed by more than one entry. */
export interface AisleDuplicate {
	term: string;
	/** Every entry claiming it, in file order. */
	entries: AisleEntry[];
}

/** One ingredient in the library that has no aisle yet. */
export interface AisleCoverageItem {
	/** The ingredient name as the recipes write it. */
	name: string;
	recipeCount: number;
	/** A few of the recipes using it, for context. */
	recipes: { slug: string; title: string }[];
	/**
	 * An existing canonical name this looks like a variant of, or null. Drives
	 * an "add as an alias of X" action rather than a new entry.
	 */
	suggestedAliasOf: string | null;
}
