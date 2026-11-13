import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecipeEntry } from './index';
import {
	detectImageType,
	isHeif,
	MAX_IMAGE_BYTES,
	removeRecipeImage,
	writeRecipeImage
} from './image';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
]);

/** A HEIC header: 32-bit box size, "ftyp", then the "heic" brand. */
const HEIC = new Uint8Array([
	0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63
]);

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
	directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cooklang-image-'));
	file = path.join(directory, 'test.cook');
	await fs.writeFile(file, 'Add @salt{}\n', 'utf8');
});

afterEach(async () => {
	await fs.rm(directory, { recursive: true, force: true });
});

describe('detectImageType', () => {
	it('recognizes the supported formats from their magic bytes', () => {
		expect(detectImageType(JPEG)).toEqual({ extension: '.jpg', mimeType: 'image/jpeg' });
		expect(detectImageType(PNG)).toEqual({ extension: '.png', mimeType: 'image/png' });
		expect(detectImageType(WEBP)).toEqual({ extension: '.webp', mimeType: 'image/webp' });
	});

	it('rejects bytes that are not an image', () => {
		expect(detectImageType(new TextEncoder().encode('<html>not a photo</html>'))).toBeNull();
		expect(detectImageType(new Uint8Array())).toBeNull();
	});
});

describe('isHeif', () => {
	it('recognizes an Apple HEIC header', () => {
		expect(isHeif(HEIC)).toBe(true);
	});

	it('does not mistake the supported formats for HEIF', () => {
		expect(isHeif(JPEG)).toBe(false);
		expect(isHeif(PNG)).toBe(false);
		expect(isHeif(WEBP)).toBe(false);
	});
});

describe('writeRecipeImage', () => {
	it('writes beside the recipe and removes the previous format', async () => {
		await fs.writeFile(path.join(directory, 'test.png'), 'old');

		await writeRecipeImage(entry(), JPEG, '.jpg');

		expect(await fs.readFile(path.join(directory, 'test.jpg'))).toEqual(Buffer.from(JPEG));
		await expect(fs.stat(path.join(directory, 'test.png'))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('keeps the existing file permissions when replacing an image', async () => {
		const target = path.join(directory, 'test.jpg');
		await fs.writeFile(target, 'old');
		await fs.chmod(target, 0o640);

		await writeRecipeImage(entry(), JPEG, '.jpg');

		expect((await fs.stat(target)).mode & 0o777).toBe(0o640);
	});

	it('leaves step images and the recipe itself alone', async () => {
		const step = path.join(directory, 'test.1.jpg');
		await fs.writeFile(step, 'step');

		await writeRecipeImage(entry(), JPEG, '.jpg');

		expect(await fs.readFile(step, 'utf8')).toBe('step');
		expect(await fs.readFile(file, 'utf8')).toBe('Add @salt{}\n');
	});
});

describe('removeRecipeImage', () => {
	it('deletes every format of the cover image', async () => {
		await fs.writeFile(path.join(directory, 'test.jpg'), 'jpg');
		await fs.writeFile(path.join(directory, 'test.jpeg'), 'jpeg');
		await fs.writeFile(path.join(directory, 'test.webp'), 'webp');
		await fs.writeFile(path.join(directory, 'test.1.png'), 'step');

		expect(await removeRecipeImage(entry())).toBe(true);

		const remaining = await fs.readdir(directory);
		expect(remaining.sort()).toEqual(['test.1.png', 'test.cook']);
	});

	it('reports nothing removed when the recipe has no image', async () => {
		expect(await removeRecipeImage(entry())).toBe(false);
	});
});

describe('MAX_IMAGE_BYTES', () => {
	it('is generous enough for a phone photo', () => {
		expect(MAX_IMAGE_BYTES).toBeGreaterThanOrEqual(10 * 1024 * 1024);
	});
});
