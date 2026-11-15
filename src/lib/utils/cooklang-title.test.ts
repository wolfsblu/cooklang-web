import { describe, expect, it } from 'vitest';
import { setFrontmatterTitle } from './cooklang-title';

describe('setFrontmatterTitle', () => {
	it('replaces an existing title line without touching the rest of the header', () => {
		const source = '---\ntitle: Old title\nservings: 2\ntags: [main]\n---\n\nAdd @salt{}.\n';

		expect(setFrontmatterTitle(source, 'New title')).toBe(
			'---\ntitle: "New title"\nservings: 2\ntags: [main]\n---\n\nAdd @salt{}.\n'
		);
	});

	it('adds a title when the frontmatter has none', () => {
		expect(setFrontmatterTitle('---\nservings: 2\n---\n\nStep.', 'Soup')).toBe(
			'---\ntitle: "Soup"\nservings: 2\n---\n\nStep.'
		);
	});

	it('adds frontmatter when the source has none', () => {
		expect(setFrontmatterTitle('Add @salt{}.', 'Soup')).toBe(
			'---\ntitle: "Soup"\n---\n\nAdd @salt{}.'
		);
	});

	it('escapes quotes and backslashes', () => {
		expect(setFrontmatterTitle('---\ntitle: Old\n---\n\nStep.', 'A "quoted" \\ title')).toBe(
			'---\ntitle: "A \\"quoted\\" \\\\ title"\n---\n\nStep.'
		);
	});
});
