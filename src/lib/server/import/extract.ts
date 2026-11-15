/**
 * Turn a recipe web page into compact, model-friendly data.
 *
 * Most recipe sites publish schema.org Recipe JSON-LD, which is dramatically
 * better input than a page's visible text: amounts, yields and method steps
 * are already separated. When no usable JSON-LD is present we fall back to a
 * deliberately simple text extraction and let the model do the reading.
 *
 * Keeping the extraction here -- rather than sending raw HTML to the model --
 * cuts thousands of tokens of navigation, styling and consent banners, and
 * keeps the prompt mostly free of page-controlled markup.
 */

export interface ExtractedRecipe {
	title: string;
	description: string | null;
	author: string | null;
	sourceUrl: string;
	/** Original yield string, e.g. "4 Portionen" or "12 cookies". */
	servings: string | null;
	prepTimeMinutes: number | null;
	cookTimeMinutes: number | null;
	totalTimeMinutes: number | null;
	category: string | null;
	cuisine: string | null;
	language: string | null;
	keywords: string[];
	ingredients: string[];
	instructions: string[];
	imageUrl: string | null;
	/** True when the data came from JSON-LD rather than visible page text. */
	structured: boolean;
	/** Plain text fallback, only populated when `structured` is false. */
	rawText: string | null;
}

const MAX_RAW_TEXT = 24_000;

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	ndash: '–',
	mdash: '—',
	hellip: '…',
	rsquo: '’',
	lsquo: '‘',
	rdquo: '”',
	ldquo: '“',
	deg: '°'
};

/** Decode the HTML entities recipe pages actually use. */
export function decodeHtmlEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (match, entity: string) => {
		if (entity.startsWith('#x') || entity.startsWith('#X')) {
			const code = Number.parseInt(entity.slice(2), 16);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}

		if (entity.startsWith('#')) {
			const code = Number.parseInt(entity.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}

		return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
	});
}

function collapseWhitespace(text: string): string {
	return text
		.replace(/\r\n?/gu, '\n')
		.replace(/[\t\f\v ]+/gu, ' ')
		.replace(/ *\n */gu, '\n')
		.replace(/\n{3,}/gu, '\n\n')
		.trim();
}

/** Strip tags without needing a DOM parser. */
function htmlToText(html: string): string {
	return collapseWhitespace(
		decodeHtmlEntities(
			html
				.replace(/<!--[\s\S]*?-->/gu, ' ')
				.replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
				.replace(/<br\s*\/?>/giu, '\n')
				.replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/giu, '\n')
				.replace(/<[^>]+>/gu, ' ')
		)
	);
}

function textFrom(value: unknown): string | null {
	if (typeof value === 'string') {
		const text = collapseWhitespace(decodeHtmlEntities(value));
		return text || null;
	}

	if (Array.isArray(value)) {
		const parts = value.map(textFrom).filter((part): part is string => Boolean(part));
		return parts.length > 0 ? parts.join(' ') : null;
	}

	if (value && typeof value === 'object') {
		const object = value as Record<string, unknown>;
		return textFrom(object.name) ?? textFrom(object.text) ?? textFrom(object['@id']);
	}

	return null;
}

function firstString(value: unknown): string | null {
	if (typeof value === 'string') return value.trim() || null;
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = firstString(item);
			if (found) return found;
		}
	}
	return null;
}

/** Parse ISO-8601 durations such as PT1H30M into minutes. */
export function parseDurationMinutes(value: unknown): number | null {
	const text = firstString(value);
	if (!text) return null;

	const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/iu.exec(text);
	if (!match) return null;

	const days = Number.parseInt(match[1] ?? '0', 10);
	const hours = Number.parseInt(match[2] ?? '0', 10);
	const minutes = Number.parseInt(match[3] ?? '0', 10);
	const seconds = Number.parseInt(match[4] ?? '0', 10);
	const total = days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);

	return total > 0 ? total : null;
}

function typeIncludesRecipe(type: unknown): boolean {
	if (typeof type === 'string') return type.toLowerCase() === 'recipe';
	if (Array.isArray(type)) return type.some((item) => typeIncludesRecipe(item));
	return false;
}

interface JsonLdData {
	recipes: Record<string, unknown>[];
	/** Nodes by `@id`, so a Recipe's `image: { "@id": ... }` can be followed. */
	byId: Map<string, Record<string, unknown>>;
}

/** Walk a JSON-LD value, collecting Recipe nodes and every `@id` reference. */
function collectJsonLdNodes(
	value: unknown,
	data: JsonLdData = { recipes: [], byId: new Map() }
): JsonLdData {
	if (Array.isArray(value)) {
		for (const item of value) collectJsonLdNodes(item, data);
		return data;
	}

	if (!value || typeof value !== 'object') return data;

	const object = value as Record<string, unknown>;
	const id = object['@id'];
	if (typeof id === 'string' && id) {
		// A `{ "@id": ... }` reference and the real node share an id. Keep the
		// richer object: the reference is visited as part of the Recipe and
		// would otherwise overwrite the ImageObject that holds the URL.
		const existing = data.byId.get(id);
		if (!existing || Object.keys(object).length > Object.keys(existing).length) {
			data.byId.set(id, object);
		}
	}
	if (typeIncludesRecipe(object['@type'])) data.recipes.push(object);

	for (const nested of Object.values(object)) {
		if (nested && typeof nested === 'object') collectJsonLdNodes(nested, data);
	}

	return data;
}

function scoreRecipe(node: Record<string, unknown>): number {
	const ingredients = Array.isArray(node.recipeIngredient) ? node.recipeIngredient.length : 0;
	const instructions = Array.isArray(node.recipeInstructions)
		? node.recipeInstructions.length
		: node.recipeInstructions
			? 1
			: 0;

	return ingredients * 2 + instructions;
}

function jsonLdScripts(html: string): string[] {
	const scripts: string[] = [];
	const pattern = /<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/giu;

	for (const match of html.matchAll(pattern)) {
		scripts.push(match[1]);
	}

	return scripts;
}

function parseJsonLd(html: string): JsonLdData {
	const data: JsonLdData = { recipes: [], byId: new Map() };

	for (const script of jsonLdScripts(html)) {
		const candidate = decodeHtmlEntities(script).trim();
		if (!candidate) continue;

		try {
			collectJsonLdNodes(JSON.parse(candidate), data);
		} catch {
			// A broken block should not prevent a second, valid block from
			// being used, and many sites ship both.
		}
	}

	return data;
}

function flattenInstructions(value: unknown): string[] {
	const steps: string[] = [];

	const visit = (node: unknown): void => {
		if (typeof node === 'string') {
			const text = collapseWhitespace(decodeHtmlEntities(node));
			if (text) steps.push(text);
			return;
		}

		if (Array.isArray(node)) {
			for (const item of node) visit(item);
			return;
		}

		if (!node || typeof node !== 'object') return;

		const object = node as Record<string, unknown>;
		const type = firstString(object['@type'])?.toLowerCase();
		const nested = object.itemListElement;

		// HowToSection contributes only its steps; its name would be a section
		// heading and the model does not need it to preserve the method.
		if (nested) {
			visit(nested);
			return;
		}

		if (type === 'howtostep' || object.text) {
			const text = textFrom(object.text);
			if (text) steps.push(text);
		}
	};

	visit(value);
	return steps;
}

function toStringList(value: unknown): string[] {
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	if (Array.isArray(value)) {
		return value
			.map((item) => firstString(item))
			.filter((item): item is string => Boolean(item?.trim()))
			.map((item) => item.trim());
	}

	const single = firstString(value);
	return single ? [single] : [];
}

function toIngredientList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((item) => textFrom(item))
		.filter((item): item is string => Boolean(item))
		.map((item) => collapseWhitespace(item));
}

function resolveHttpUrl(value: string, pageUrl: string): string | null {
	try {
		const url = new URL(value.trim(), pageUrl);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}

/**
 * Resolve an `image` value, including JSON-LD references.
 *
 * Chefkoch, for one, writes `image: { "@id": "#primaryimage" }` and puts the
 * actual URL on a separate ImageObject node. Returning the `@id` as-is would
 * produce the page URL rather than a picture.
 */
function imageUrl(
	value: unknown,
	byId: ReadonlyMap<string, Record<string, unknown>>,
	pageUrl: string,
	depth = 0
): string | null {
	if (depth > 4) return null;

	if (typeof value === 'string') return resolveHttpUrl(value, pageUrl);

	if (Array.isArray(value)) {
		for (const item of value) {
			const found = imageUrl(item, byId, pageUrl, depth);
			if (found) return found;
		}
		return null;
	}

	if (!value || typeof value !== 'object') return null;

	const object = value as Record<string, unknown>;
	const direct =
		firstString(object.url) ?? firstString(object.contentUrl) ?? firstString(object.thumbnailUrl);

	if (direct) return resolveHttpUrl(direct, pageUrl);

	const reference = firstString(object['@id']);
	if (!reference) return null;

	const target = byId.get(reference);
	if (target) return imageUrl(target, byId, pageUrl, depth + 1);

	// Some publishers use an absolute image URL directly as `@id`.
	return reference.includes('#') ? null : resolveHttpUrl(reference, pageUrl);
}

function fromJsonLd(
	node: Record<string, unknown>,
	pageUrl: string,
	byId: ReadonlyMap<string, Record<string, unknown>>
): ExtractedRecipe {
	const title = textFrom(node.name) ?? 'Imported recipe';
	const ingredients = toIngredientList(node.recipeIngredient);
	const instructions = flattenInstructions(node.recipeInstructions);
	const source = firstString(
		(node.mainEntityOfPage as Record<string, unknown> | undefined)?.['@id']
	);

	return {
		title,
		description: textFrom(node.description) ?? textFrom(node.abstract),
		author: textFrom(node.author) ?? textFrom(node.contributor),
		sourceUrl: source ?? pageUrl,
		servings: firstString(node.recipeYield),
		prepTimeMinutes: parseDurationMinutes(node.prepTime),
		cookTimeMinutes: parseDurationMinutes(node.cookTime),
		totalTimeMinutes: parseDurationMinutes(node.totalTime),
		category: firstString(node.recipeCategory),
		cuisine: firstString(node.recipeCuisine),
		language: firstString(node.inLanguage),
		keywords: toStringList(node.keywords),
		ingredients,
		instructions,
		imageUrl: imageUrl(node.image, byId, pageUrl),
		structured: true,
		rawText: null
	};
}

function pageTitle(html: string): string | null {
	const match = /<title\b[^>]*>([\s\S]*?)<\/title>/iu.exec(html);
	return match ? textFrom(match[1]) : null;
}

function fromPageText(html: string, pageUrl: string): ExtractedRecipe {
	// Removing the head first keeps the <title> from being repeated in the body
	// text; script/style blocks are already stripped by htmlToText.
	const body = htmlToText(
		html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/iu, ' ').replace(/<!--[\s\S]*?-->/gu, ' ')
	);

	return {
		title: pageTitle(html) ?? 'Imported recipe',
		description: null,
		author: null,
		sourceUrl: pageUrl,
		servings: null,
		prepTimeMinutes: null,
		cookTimeMinutes: null,
		totalTimeMinutes: null,
		category: null,
		cuisine: null,
		language: null,
		keywords: [],
		ingredients: [],
		instructions: [],
		imageUrl: null,
		structured: false,
		rawText: body.slice(0, MAX_RAW_TEXT) || null
	};
}

/**
 * Extract the best recipe from a page.
 *
 * JSON-LD wins whenever it contains at least an ingredient list or method.
 * The visible-text fallback is only used for pages that publish neither.
 */
export function extractRecipe(html: string, pageUrl: string): ExtractedRecipe {
	const data = parseJsonLd(html);
	const recipes = data.recipes.sort((a, b) => scoreRecipe(b) - scoreRecipe(a));
	const best = recipes.find((recipe) => scoreRecipe(recipe) > 0);

	if (best) {
		const extracted = fromJsonLd(best, pageUrl, data.byId);
		if (extracted.ingredients.length > 0 || extracted.instructions.length > 0) {
			return extracted;
		}
	}

	return fromPageText(html, pageUrl);
}
