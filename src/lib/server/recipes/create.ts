/**
 * Create a new recipe file in the library.
 *
 * This is the only write path that adds a file rather than replacing one, so
 * it owns the naming rules: a human-readable filename derived from the title,
 * an optional folder, no traversal, and a numeric suffix instead of silently
 * overwriting an existing recipe. The write goes through the same atomic
 * temp-and-rename helper as every other store.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { createLock, writeFileAtomic } from '../storage.js';
import { getIndex, invalidateRecipe } from './index.js';
import { slugForRelPath } from './slug.js';

/** Directories the index deliberately skips; recipes created there vanish. */
const IGNORED_DIRS = new Set(['config', 'db', 'reports', 'node_modules']);

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/gu;
// Built from code points so the lint rule for literal control characters in
// regular expressions stays quiet; these still have to be removed from names.
const CONTROL_FILENAME_CHARS = new RegExp(
	`[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}]`,
	'gu'
);
const MAX_BASE_LENGTH = 120;
const MAX_FOLDER_SEGMENT_LENGTH = 80;

export class RecipeCreateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RecipeCreateError';
	}
}

/**
 * Turn a title into a safe filename stem.
 *
 * Keeps spaces and capitals because these filenames are browsed on a NAS as
 * well as in the app; strips only what a path or Windows share cannot hold.
 */
export function recipeFileBase(title: string): string {
	const base = title
		.trim()
		.replace(/\.cook$/iu, '')
		.normalize('NFC')
		.replace(CONTROL_FILENAME_CHARS, ' ')
		.replace(INVALID_FILENAME_CHARS, ' ')
		.replace(/\s+/gu, ' ')
		.replace(/^[.\s]+|[.\s]+$/gu, '')
		.slice(0, MAX_BASE_LENGTH)
		.trim();

	return base || 'Imported recipe';
}

/** Split and sanitise an optional folder path such as "Dinner/Quick". */
export function normalizeFolder(folder: string): string[] {
	const raw = folder.trim().replace(/\\/gu, '/');
	if (!raw) return [];

	const segments = raw.split('/').filter((segment) => segment.trim() !== '');
	const cleaned: string[] = [];

	for (const segment of segments) {
		if (segment === '.' || segment === '..') {
			throw new RecipeCreateError('Folder names cannot contain "." or "..".');
		}

		const name = segment
			.normalize('NFC')
			.replace(CONTROL_FILENAME_CHARS, ' ')
			.replace(INVALID_FILENAME_CHARS, ' ')
			.replace(/\s+/gu, ' ')
			.replace(/^[.\s]+|[.\s]+$/gu, '')
			.slice(0, MAX_FOLDER_SEGMENT_LENGTH)
			.trim();

		if (!name) throw new RecipeCreateError('The folder name is not valid.');
		if (IGNORED_DIRS.has(name.toLowerCase())) {
			throw new RecipeCreateError(`"${name}" is reserved by the app and cannot hold recipes.`);
		}

		cleaned.push(name);
	}

	return cleaned;
}

export interface CreateRecipeInput {
	title: string;
	source: string;
	/** Filename stem; defaults to the title. `.cook` is added automatically. */
	filename?: string;
	/** Optional folder relative to the recipe root. */
	folder?: string;
}

export interface CreatedRecipe {
	slug: string;
	relPath: string;
	title: string;
}

const withLock = createLock();

async function availableTarget(
	directory: string,
	base: string
): Promise<{ filename: string; target: string }> {
	for (let attempt = 0; attempt < 1_000; attempt++) {
		const filename = attempt === 0 ? `${base}.cook` : `${base} ${attempt + 1}.cook`;
		const target = path.join(directory, filename);

		try {
			await fs.access(target);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return { filename, target };
			}
			throw error;
		}
	}

	throw new RecipeCreateError(
		'There are too many recipes with that name. Choose a different title.'
	);
}

/** Write a new recipe and return the slug the index assigned it. */
export async function createRecipe(input: CreateRecipeInput): Promise<CreatedRecipe> {
	if (!input.source.trim()) {
		throw new RecipeCreateError('A recipe cannot be created empty.');
	}

	if (input.source.length > 512 * 1024) {
		throw new RecipeCreateError('This recipe is too large to save.');
	}

	const base = recipeFileBase(input.filename?.trim() || input.title);
	const folder = normalizeFolder(input.folder ?? '');

	return withLock(async () => {
		const directory = path.join(config.RECIPE_PATH, ...folder);
		const { filename, target } = await availableTarget(directory, base);
		const relPath = [...folder, filename].join('/');

		await writeFileAtomic(target, input.source.replace(/\s+$/u, '') + '\n');

		invalidateRecipe(relPath);
		const index = await getIndex();
		const entry = index.entries.find((candidate) => candidate.relPath === relPath);

		return {
			slug: entry?.slug ?? slugForRelPath(relPath),
			relPath,
			title: entry?.title ?? input.title
		};
	});
}
