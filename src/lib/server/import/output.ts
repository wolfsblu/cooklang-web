/**
 * Normalise what the model produced before it reaches the parser.
 *
 * Models occasionally wrap output in fences or omit the frontmatter the prompt
 * asked for. Both are cheap to fix deterministically: strip the wrapper, then
 * guarantee a title and source so an imported recipe always records where it
 * came from.
 */

const FENCED = /```(?:cooklang|markdown)?\s*\r?\n?([\s\S]*?)```/iu;

/** Remove Markdown fences and surrounding chatter. */
export function cleanModelOutput(output: string): string {
	const trimmed = output.replace(/^\uFEFF/u, '').trim();
	if (!trimmed) return '';

	const fenced = FENCED.exec(trimmed);
	if (fenced) return fenced[1].trim();

	// Some models preface the source with "Here is the recipe:" and then
	// honour the frontmatter request. If the first delimiter appears within
	// the opening lines, start there rather than turning the preface into a
	// stray recipe paragraph. A recipe with no frontmatter never gets here
	// because it has no `---` near the top.
	const lines = trimmed.split(/\r?\n/u);
	const frontmatterStart = lines.findIndex((line, index) => index < 6 && line.trim() === '---');
	if (frontmatterStart > 0) return lines.slice(frontmatterStart).join('\n').trim();

	return trimmed;
}

function yamlString(value: string): string {
	// JSON strings are valid YAML double-quoted scalars, which avoids having to
	// reason about colons, quotes and leading special characters in titles.
	return JSON.stringify(value);
}

/**
 * Remove a second amount written after an ingredient.
 *
 * Cooklang already renders `@carrots{2}` as "carrots (2)". A trailing
 * "(about 150 g)" is not a note the renderer can place sensibly; it ends up as
 * a malformed parenthetical. The amount is redundant, so drop it rather than
 * turning it into an ingredient note.
 */
const REDUNDANT_AMOUNT_AFTER_INGREDIENT =
	/(@[^@#~{}\n]+?\{[^}]*\}|@[^\s@#~{}.,;:!?]+)[ \t]*\((?:about|approx\.?|ca\.?|circa|roughly|around|~)?\s*\d+(?:[.,]\d+)?\s*(?:g|kg|mg|ml|cl|dl|l|oz|lb|lbs|tbsp|tsp|cups?|grams?|kilograms?|millilit(?:er|re)s?|lit(?:er|re)s?|ounces?|pounds?)\b[^)]*\)/giu;

export function stripRedundantAmounts(source: string): string {
	return source.replace(REDUNDANT_AMOUNT_AFTER_INGREDIENT, '$1');
}

/**
 * Ensure the source has frontmatter with at least a title, and a source URL
 * when there is one.
 *
 * Existing values are kept: the model may have found a more specific canonical
 * URL in the page's structured data than the one the user pasted. Photo
 * imports pass `null`, because an upload has no page to cite.
 */
export function ensureFrontmatter(
	source: string,
	fallbackTitle: string,
	sourceUrl: string | null
): string {
	const body = source.trim();
	const frontmatter = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u.exec(body);

	if (!frontmatter) {
		return [
			'---',
			`title: ${yamlString(fallbackTitle)}`,
			...(sourceUrl ? [`source: ${yamlString(sourceUrl)}`] : []),
			'---',
			'',
			body,
			''
		].join('\n');
	}

	const header = frontmatter[1];
	const additions: string[] = [];

	if (!/^title[ \t]*:/imu.test(header)) additions.push(`title: ${yamlString(fallbackTitle)}`);
	if (sourceUrl && !/^source[ \t]*:/imu.test(header))
		additions.push(`source: ${yamlString(sourceUrl)}`);

	const nextHeader =
		additions.length > 0 ? `${header.replace(/\s+$/u, '')}\n${additions.join('\n')}` : header;

	const rest = body.slice(frontmatter[0].length);
	return (
		`---\n${nextHeader}\n---\n${rest.startsWith('\n') ? '' : '\n'}${rest}`.replace(/\s+$/u, '') +
		'\n'
	);
}
