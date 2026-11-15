/**
 * Replace the title in a recipe's YAML frontmatter.
 *
 * The import review lets the title be edited without opening the source, so
 * this keeps the visible title, the filename suggestion and the saved recipe
 * in sync. The value is emitted as a JSON/YAML double-quoted string, which is
 * safe for colons, quotes and leading punctuation.
 */
export function setFrontmatterTitle(source: string, title: string): string {
	const value = JSON.stringify(title.trim() || 'Imported recipe');
	const frontmatter = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/u.exec(source);

	if (!frontmatter) {
		return `---\ntitle: ${value}\n---\n\n${source}`;
	}

	const header = frontmatter[1];
	const nextHeader = /^title[ \t]*:/imu.test(header)
		? header.replace(/^title[ \t]*:.*$/imu, `title: ${value}`)
		: `title: ${value}\n${header}`;

	return source.replace(frontmatter[0], () => `---\n${nextHeader}\n---`);
}
