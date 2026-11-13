import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLock, writeFileAtomic } from './storage.js';

describe('createLock', () => {
	it('runs operations one at a time, in call order', async () => {
		const withLock = createLock();
		const events: string[] = [];

		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		const first = withLock(async () => {
			events.push('first:start');
			await gate;
			events.push('first:end');
		});

		const second = withLock(async () => {
			events.push('second');
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(events).toEqual(['first:start']);

		release();
		await Promise.all([first, second]);
		expect(events).toEqual(['first:start', 'first:end', 'second']);
	});

	it('keeps the queue alive after a rejected operation', async () => {
		const withLock = createLock();

		await expect(
			withLock(async () => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');

		await expect(withLock(async () => 'recovered')).resolves.toBe('recovered');
	});
});

describe('writeFileAtomic', () => {
	it('writes the file and leaves no temp file behind', async () => {
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cooklang-storage-'));
		const target = path.join(directory, 'nested', 'file.txt');

		try {
			await writeFileAtomic(target, 'hello');

			expect(await fs.readFile(target, 'utf8')).toBe('hello');
			expect(await fs.readdir(path.dirname(target))).toEqual(['file.txt']);
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	});

	it('replaces an existing file in place', async () => {
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cooklang-storage-'));
		const target = path.join(directory, 'file.txt');

		try {
			await fs.writeFile(target, 'old', 'utf8');
			await writeFileAtomic(target, 'new');

			expect(await fs.readFile(target, 'utf8')).toBe('new');
			expect(await fs.readdir(directory)).toEqual(['file.txt']);
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	});

	it('applies an explicit mode', async () => {
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cooklang-storage-'));
		const target = path.join(directory, 'file.txt');

		try {
			await writeFileAtomic(target, 'hello', { mode: 0o640 });
			expect((await fs.stat(target)).mode & 0o777).toBe(0o640);
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	});
});
