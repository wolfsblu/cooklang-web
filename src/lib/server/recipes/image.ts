/**
 * Recipe cover images.
 *
 * Cooklang keeps a recipe's artwork beside the recipe file: `Easy Pancakes.jpg`
 * belongs to `Easy Pancakes.cook`. Uploading replaces that file; the index
 * picks the new image up on its next scan, keyed by mtime so browsers do not
 * keep showing the old bytes.
 *
 * Reads never come through here -- the image is served from the index -- so
 * this module only owns the write and delete side.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { RecipeEntry } from './index.js';
import { IMAGE_EXTENSIONS } from './index.js';
import { createLock, writeFileAtomic } from '../storage.js';

/** Largest upload accepted, in bytes. Phone photos sit well below this. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export type ImageExtension = '.jpg' | '.png' | '.webp';

export interface DetectedImage {
	extension: ImageExtension;
	mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Identify an image from its leading bytes rather than trusting the browser's
 * `File.type`, which is content-type by filename and trivially wrong.
 */
export function detectImageType(bytes: Uint8Array): DetectedImage | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return { extension: '.jpg', mimeType: 'image/jpeg' };
	}

	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return { extension: '.png', mimeType: 'image/png' };
	}

	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 && // R
		bytes[1] === 0x49 && // I
		bytes[2] === 0x46 && // F
		bytes[3] === 0x46 && // F
		bytes[8] === 0x57 && // W
		bytes[9] === 0x45 && // E
		bytes[10] === 0x42 && // B
		bytes[11] === 0x50 // P
	) {
		return { extension: '.webp', mimeType: 'image/webp' };
	}

	return null;
}

/** ISO-BMFF brands used by Apple's HEIC/HEIF photos. */
const HEIF_BRANDS = new Set([
	'heic',
	'heix',
	'hevc',
	'hevx',
	'heim',
	'heis',
	'hevm',
	'hevs',
	'mif1',
	'msf1'
]);

/**
 * Whether the bytes are a HEIC/HEIF file.
 *
 * These cannot be stored as-is: Chrome and Firefox will not render them, and
 * the index only knows the formats every browser displays. The client converts
 * them when its browser can decode them (Safari); this check exists so anything
 * that reaches the server unscathed gets a useful explanation rather than the
 * generic "choose a JPEG".
 */
export function isHeif(bytes: Uint8Array): boolean {
	if (bytes.length < 12) return false;

	const ftyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
	if (!ftyp) return false;

	const brand = String.fromCharCode(...bytes.slice(8, 12));
	return HEIF_BRANDS.has(brand);
}

/** `.../Easy Pancakes.cook` -> `.../Easy Pancakes`, the stem images share. */
function imageBasePath(entry: RecipeEntry): string {
	const name = path.basename(entry.absPath);
	const extension = path.extname(name);
	return path.join(path.dirname(entry.absPath), name.slice(0, -extension.length));
}

/** One image write at a time, so two tabs cannot delete each other's upload. */
const withLock = createLock();

async function removeIfExists(target: string): Promise<void> {
	try {
		await fs.unlink(target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
}

/**
 * Store `bytes` as the recipe's cover image.
 *
 * The new file is written before the old format is removed: a failure leaves
 * the previous image in place instead of deleting the only copy.
 */
export async function writeRecipeImage(
	entry: RecipeEntry,
	bytes: Uint8Array,
	extension: ImageExtension
): Promise<void> {
	await withLock(async () => {
		const base = imageBasePath(entry);
		const target = `${base}${extension}`;

		let mode: number | undefined;
		try {
			mode = (await fs.stat(target)).mode & 0o777;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}

		await writeFileAtomic(target, bytes, mode === undefined ? {} : { mode });

		// Replacing a PNG with a JPEG must not leave the PNG behind: the index
		// prefers .jpg, so it would pick the new one, but the stale file would
		// still occupy the NAS and resurface if the new one were renamed.
		await Promise.all(
			IMAGE_EXTENSIONS.filter((candidate) => candidate !== extension).map((candidate) =>
				removeIfExists(`${base}${candidate}`)
			)
		);
	});
}

/** Delete every format of the recipe's cover image. Step images are untouched. */
export async function removeRecipeImage(entry: RecipeEntry): Promise<boolean> {
	return withLock(async () => {
		const base = imageBasePath(entry);
		let removed = false;

		for (const extension of IMAGE_EXTENSIONS) {
			const target = `${base}${extension}`;
			try {
				await fs.unlink(target);
				removed = true;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			}
		}

		return removed;
	});
}
