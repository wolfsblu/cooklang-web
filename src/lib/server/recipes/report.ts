/**
 * Turn the Cooklang parser's report into something the editor can render.
 *
 * cooklang-rs returns a coloured, box-drawn diagnostic report as a string. It
 * is excellent in a terminal and unusable in a panel: hundreds of characters
 * of source snippets, styling spans and box drawing for one warning. This
 * keeps the first line of each diagnostic (the actionable part) and, when the
 * snippet identifies one, the source line it points at.
 */

import type { DiagnosticSeverity, RecipeDiagnostic } from '$lib/types/editor';

export interface EmptyEntityProblem {
	message: string;
	/** 1-based line number. */
	line: number;
}

const EMPTY_ENTITY = /([@#~])\{\s*\}/u;

/**
 * Find an entity whose braces are empty and whose name is missing.
 *
 * `@{}`, `#{}` and `~{}` make cooklang-rs panic rather than return a warning.
 * Catching the obvious shape here keeps that from looking like an unexplained
 * parser failure, and gives the editor a precise message to display.
 */
export function findEmptyEntity(source: string): EmptyEntityProblem | null {
	const match = EMPTY_ENTITY.exec(source);
	if (!match) return null;

	const line = source.slice(0, match.index).split('\n').length;
	const trigger = match[1];

	const message =
		trigger === '@'
			? 'An ingredient name is missing before the braces.'
			: trigger === '#'
				? 'A cookware name is missing before the braces.'
				: 'The timer needs a name or a duration.';

	return { message, line };
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

/** ANSI SGR sequences, built at runtime so the lint rule sees no ESC literal. */
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'gu');

function decodeEntities(text: string): string {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (match, entity: string) => {
		if (entity.startsWith('#x') || entity.startsWith('#X')) {
			return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
		}
		if (entity.startsWith('#')) {
			return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
		}
		return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
	});
}

/** Strip HTML spans and ANSI escapes without needing a DOM or a dependency. */
function toPlainText(report: string): string {
	return decodeEntities(
		report
			.replace(/<[^>]*>/gu, '')
			// Colour codes are not normally present in the string, but the CLI
			// and the WASM parser format diagnostics with the same library.
			.replace(ANSI_ESCAPE, '')
	);
}

const SEVERITY = new Set<DiagnosticSeverity>(['warning', 'error', 'help']);

/**
 * Extract diagnostics from a Cooklang parser report.
 *
 * Duplicates are dropped by severity and message: a single deprecated `>>`
 * metadata block is reported once at the top and again in the suggestion.
 */
export function diagnosticsFromReport(report: string): RecipeDiagnostic[] {
	if (!report.trim()) return [];

	const diagnostics: RecipeDiagnostic[] = [];
	const seen = new Set<string>();
	let current: RecipeDiagnostic | null = null;

	for (const line of toPlainText(report).split('\n')) {
		const message = line.match(/^\s*(Warning|Error|Help):\s*(.*)$/u);

		if (message) {
			const severity = message[1].toLowerCase() as DiagnosticSeverity;
			const text = message[2].trim();

			if (SEVERITY.has(severity) && text) {
				const key = `${severity}:${text}`;
				if (!seen.has(key)) {
					seen.add(key);
					current = { severity, message: text, line: null };
					diagnostics.push(current);
				} else {
					current = null;
				}
			} else {
				current = null;
			}

			continue;
		}

		// Miette's source excerpt looks like "4 │ >> servings: 2".
		if (current && current.line === null) {
			const sourceLine = line.match(/^\s*(\d+)\s*[│|]/u);
			if (sourceLine) current.line = Number.parseInt(sourceLine[1], 10);
		}
	}

	return diagnostics;
}
