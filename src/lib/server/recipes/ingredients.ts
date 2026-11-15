/**
 * Reuse the library's ingredient spellings without asking the model twice.
 *
 * The prompt already contains the vocabulary and asks the model to use it, but
 * models are inconsistent about case, plurals and articles. This pass fixes the
 * conservative cases deterministically: exact names ignoring case and
 * punctuation, and singular/plural variants of the same word. It deliberately
 * does not guess at semantic matches -- "red onion" is not rewritten to
 * "onion" just because both exist.
 */

import type { CompletionTerm } from '#lib/types/editor.js';
import type { IngredientMatch } from '#lib/types/import.js';

export interface CanonicalizedSource {
	source: string;
	matches: IngredientMatch[];
}

/**
 * Match an ingredient entity, preserving its quantity braces.
 *
 * Braced names may contain spaces; unbraced names stop at whitespace or
 * punctuation, matching how the Cooklang parser reads them. Escaped `\@` is
 * left alone.
 */
const INGREDIENT_TOKEN =
	/(?<![\p{L}\p{N}_.%+\-\\])@(?:([^@#~{}\n]+?)\{([^}]*)\}|([^\s@#~{}.,;:!?]+))/gu;

/** Lowercase, accent-free, punctuation-free form used for comparison. */
export function normalizeIngredientName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.replace(/&/gu, ' and ')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.replace(/\s+/gu, ' ');
}

function singularToken(token: string): string {
	if (token.length <= 3) return token;

	if (/ies$/u.test(token)) return `${token.slice(0, -3)}y`;
	if (/ves$/u.test(token)) return `${token.slice(0, -3)}f`;
	if (/(ches|shes|xes|zes|sses)$/u.test(token)) return token.slice(0, -2);
	if (/oes$/u.test(token)) return token.slice(0, -2);
	if (/s$/u.test(token) && !/ss$/u.test(token)) return token.slice(0, -1);

	return token;
}

/** Singularise only the head noun, so "tinned tomatoes" keeps its qualifier. */
function singularKey(normalized: string): string {
	const words = normalized.split(' ');
	if (words.length === 0) return normalized;
	words[words.length - 1] = singularToken(words[words.length - 1]);
	return words.join(' ');
}

interface Candidate {
	name: string;
	count: number;
}

function better(current: Candidate | undefined, candidate: Candidate): Candidate {
	if (!current) return candidate;
	if (candidate.count !== current.count)
		return candidate.count > current.count ? candidate : current;
	return candidate.name.localeCompare(current.name) < 0 ? candidate : current;
}

/**
 * Rewrite ingredient names in `source` to the library's spelling where the
 * match is exact apart from case, punctuation, or pluralisation.
 */
export function canonicalizeIngredientNames(
	source: string,
	vocabulary: readonly CompletionTerm[]
): CanonicalizedSource {
	const byNormalized = new Map<string, Candidate>();
	const bySingular = new Map<string, Candidate | null>();

	for (const term of vocabulary) {
		const name = term.name.trim();
		if (!name || name.startsWith('./') || name.startsWith('/')) continue;

		const normalized = normalizeIngredientName(name);
		if (!normalized) continue;

		const candidate: Candidate = { name, count: Math.max(1, term.count) };
		byNormalized.set(normalized, better(byNormalized.get(normalized), candidate));

		const key = singularKey(normalized);
		const existing = bySingular.get(key);
		if (!existing) {
			bySingular.set(key, candidate);
		} else if (existing && normalizeIngredientName(existing.name) !== normalized) {
			// "egg" and "eggs" both exist as separate spellings; picking one
			// would be arbitrary, so leave that word alone.
			bySingular.set(key, null);
		}
	}

	function canonicalFor(name: string): string | null {
		const normalized = normalizeIngredientName(name);
		if (!normalized) return null;

		const exact = byNormalized.get(normalized);
		if (exact) return exact.name;

		const singular = bySingular.get(singularKey(normalized));
		if (singular && normalizeIngredientName(singular.name) !== normalized) {
			return singular.name;
		}

		return null;
	}

	const matches: IngredientMatch[] = [];
	const seen = new Set<string>();

	const rewritten = source.replace(
		INGREDIENT_TOKEN,
		(
			full: string,
			bracedName: string | undefined,
			_quantity: string | undefined,
			bareName: string | undefined
		) => {
			const name = bracedName ?? bareName;
			if (!name) return full;
			if (name.startsWith('./') || name.startsWith('/')) return full;

			const canonical = canonicalFor(name);
			if (!canonical || canonical === name) return full;

			const key = `${name.toLowerCase()}\u0000${canonical.toLowerCase()}`;
			if (!seen.has(key)) {
				seen.add(key);
				matches.push({ from: name, to: canonical });
			}

			// Keep the original braces and the space between an optional note
			// and the entity's quantity untouched.
			return `@${canonical}${full.slice(1 + name.length)}`;
		}
	);

	return { source: rewritten, matches };
}
