/**
 * Cooklang syntax highlighting for the editor overlay.
 *
 * This is a tokenizer rather than an HTML string builder. The editor renders
 * tokens as Svelte spans, so highlighting can never inject markup from a
 * recipe, and the textarea on top remains the actual editable document.
 *
 * It is intentionally forgiving: the parser is the authority on validity, and
 * highlighting partial syntax while the user is mid-word must not flicker or
 * swallow the rest of the line.
 */

export type CooklangTokenKind =
	| 'text'
	| 'comment'
	| 'section'
	| 'metadata-key'
	| 'metadata-value'
	| 'frontmatter'
	| 'frontmatter-key'
	| 'frontmatter-delimiter'
	| 'ingredient'
	| 'ingredient-quantity'
	| 'cookware'
	| 'cookware-quantity'
	| 'timer'
	| 'timer-quantity'
	| 'note';

export interface CooklangToken {
	text: string;
	kind: CooklangTokenKind;
}

/** Characters that end an unbraced name and are never part of one. */
const NAME_BREAK = /[\s@#~{}()[\].,;:!?]/u;

function push(tokens: CooklangToken[], text: string, kind: CooklangTokenKind): void {
	if (!text) return;

	const previous = tokens[tokens.length - 1];
	if (previous && previous.kind === kind) {
		previous.text += text;
	} else {
		tokens.push({ text, kind });
	}
}

/** Consume a balanced `{...}` starting at `start`, respecting backslash escapes. */
function braceEnd(line: string, start: number): number {
	let depth = 0;

	for (let i = start; i < line.length; i++) {
		const char = line[i];

		if (char === '\\') {
			i++;
			continue;
		}

		if (char === '{') depth++;
		else if (char === '}') {
			depth--;
			if (depth === 0) return i + 1;
		}
	}

	// An unclosed brace highlights to the end of the line, which is the useful
	// signal while the user is still typing it.
	return line.length;
}

/**
 * Consume a balanced `(...)` starting at `start`, respecting backslash escapes.
 *
 * Cooklang places an optional note after the quantity: `@onion{1}(diced)`.
 */
function parenEnd(line: string, start: number): number {
	let depth = 0;

	for (let i = start; i < line.length; i++) {
		const char = line[i];

		if (char === '\\') {
			i++;
			continue;
		}

		if (char === '(') depth++;
		else if (char === ')') {
			depth--;
			if (depth === 0) return i + 1;
		}
	}

	return line.length;
}

interface EntityKind {
	name: CooklangTokenKind;
	quantity: CooklangTokenKind;
}

const ENTITY_KINDS: Record<string, EntityKind> = {
	'@': { name: 'ingredient', quantity: 'ingredient-quantity' },
	'#': { name: 'cookware', quantity: 'cookware-quantity' },
	'~': { name: 'timer', quantity: 'timer-quantity' }
};

/**
 * Parse one non-metadata line into text and entity tokens.
 *
 * A multi-word name is only legal with braces (`@olive oil{}`), so the space
 * rule and the brace rule have to agree with what the real parser does. A
 * lookahead finds a brace before any sentence punctuation; when there is one,
 * everything up to it is the name. Otherwise the name is one word.
 */
function highlightInline(line: string, tokens: CooklangToken[]): void {
	let i = 0;

	while (i < line.length) {
		const char = line[i];

		if (char === '\\' && i + 1 < line.length) {
			push(tokens, line.slice(i, i + 2), 'text');
			i += 2;
			continue;
		}

		if (line.startsWith('--', i)) {
			push(tokens, line.slice(i), 'comment');
			return;
		}

		const kinds = ENTITY_KINDS[char];
		if (!kinds) {
			// Take a whole run of ordinary text in one go.
			let end = i + 1;
			while (
				end < line.length &&
				!ENTITY_KINDS[line[end]] &&
				!line.startsWith('--', end) &&
				line[end] !== '\\'
			) {
				end++;
			}
			push(tokens, line.slice(i, end), 'text');
			i = end;
			continue;
		}

		const nameStart = i + 1;
		const rest = line.slice(nameStart);
		const braced = rest.match(/^([^@#~{}()[\].,;:!?]+)\{/u);

		let nameEnd: number;
		if (braced) {
			nameEnd = nameStart + braced[1].length;
		} else {
			let end = nameStart;
			while (end < line.length && !NAME_BREAK.test(line[end])) end++;
			nameEnd = end;
		}

		push(tokens, line.slice(i, nameEnd), kinds.name);

		let entityEnd = nameEnd;

		if (line[entityEnd] === '{') {
			entityEnd = braceEnd(line, entityEnd);
			push(tokens, line.slice(nameEnd, entityEnd), kinds.quantity);
		}

		if (line[entityEnd] === '(') {
			const noteEnd = parenEnd(line, entityEnd);
			push(tokens, line.slice(entityEnd, noteEnd), 'note');
			entityEnd = noteEnd;
		}

		// Empty name and no brace: highlight the trigger as the entity anyway,
		// so an incomplete token is visible while it is being typed.
		i = entityEnd;
	}
}

function highlightFrontmatterLine(line: string, tokens: CooklangToken[]): void {
	const colon = line.indexOf(':');

	if (colon > 0) {
		push(tokens, line.slice(0, colon + 1), 'frontmatter-key');
		push(tokens, line.slice(colon + 1), 'frontmatter');
		return;
	}

	push(tokens, line, 'frontmatter');
}

function highlightMetadataLine(line: string, tokens: CooklangToken[]): void {
	const match = line.match(/^(\s*>>\s*.*?:)(.*)$/u);

	if (match) {
		push(tokens, match[1], 'metadata-key');
		push(tokens, match[2], 'metadata-value');
		return;
	}

	push(tokens, line, 'metadata-key');
}

/** Tokenize a recipe. Concatenating every token's text always returns `source`. */
export function highlightCooklang(source: string): CooklangToken[] {
	const tokens: CooklangToken[] = [];
	const lines = source.split('\n');

	const firstContent = lines.findIndex((line) => line.trim() !== '');
	const frontmatterStart =
		firstContent >= 0 && lines[firstContent].trim() === '---' ? firstContent : -1;

	let frontmatterEnd = -1;
	if (frontmatterStart >= 0) {
		for (let i = frontmatterStart + 1; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				frontmatterEnd = i;
				break;
			}
		}
	}

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const trimmed = line.trim();

		if (index === frontmatterStart || index === frontmatterEnd) {
			push(tokens, line, 'frontmatter-delimiter');
		} else if (frontmatterStart >= 0 && index > frontmatterStart && index < frontmatterEnd) {
			highlightFrontmatterLine(line, tokens);
		} else if (trimmed.startsWith('--')) {
			push(tokens, line, 'comment');
		} else if (/^==.*==$/u.test(trimmed)) {
			push(tokens, line, 'section');
		} else if (/^\s*>>/u.test(line)) {
			highlightMetadataLine(line, tokens);
		} else {
			highlightInline(line, tokens);
		}

		if (index < lines.length - 1) push(tokens, '\n', 'text');
	}

	return tokens;
}
