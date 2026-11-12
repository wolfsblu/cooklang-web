import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecipeEntry } from './index';
import { readRecipeSource, RecipeConflictError, saveRecipeSource } from './write';

let directory: string;
let file: string;

const entry = (): RecipeEntry =>
	({
		slug: 'test',
		relPath: 'test.cook',
		absPath: file,
		title: 'Test',
		description: null,
		tags: [],
		course: null,
		servings: null,
		timeMinutes: null,
		image: null,
		stepImages: {},
		mtimeMs: 0,
		size: 0,
		ingredientNames: [],
		cookwareNames: [],
		searchable: { title: '', tags: '', ingredients: '', body: '' }
	}) satisfies RecipeEntry;

beforeEach(async () => {
	directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cooklang-write-'));
	file = path.join(directory, 'test.cook');
	await fs.writeFile(file, 'Add @salt{}\n', 'utf8');
});

afterEach(async () => {
	await fs.rm(directory, { recursive: true, force: true });
});

describe('saveRecipeSource', () => {
	it('reads the source and the version to save against', async () => {
		const result = await readRecipeSource(entry());

		expect(result.source).toBe('Add @salt{}\n');
		expect(Number.isFinite(result.mtimeMs)).toBe(true);
	});

	it('writes atomically and returns the new mtime', async () => {
		const before = await readRecipeSource(entry());
		const mtimeMs = await saveRecipeSource(entry(), 'Add @pepper{}\n', before.mtimeMs);

		expect(await fs.readFile(file, 'utf8')).toBe('Add @pepper{}\n');
		expect(Number.isFinite(mtimeMs)).toBe(true);
	});

	it('refuses to overwrite a file that changed after it was opened', async () => {
		const before = await readRecipeSource(entry());

		// Simulate an external editor, SMB client or another browser tab.
		await fs.writeFile(file, '-- changed elsewhere\n', 'utf8');
		// Make the change visible even on a filesystem with whole-second mtime
		// resolution, where two writes in the same tick look identical.
		await fs.utimes(file, new Date(), new Date(Date.now() + 2000));

		await expect(
			saveRecipeSource(entry(), 'Add @pepper{}\n', before.mtimeMs)
		).rejects.toBeInstanceOf(RecipeConflictError);

		expect(await fs.readFile(file, 'utf8')).toBe('-- changed elsewhere\n');
	});
});
