/**
 * Fetch a recipe page with bounds.
 *
 * Redirects are followed by hand so every destination gets the same
 * public-host check. The body has a hard byte limit and the whole request is
 * time-boxed, because an import is one user action and should never tie up a
 * request forever.
 */

import { detectImageType, MAX_IMAGE_BYTES, type ImageExtension } from '../recipes/image.js';
import { assertPublicHost, ImportUrlError, parseImportUrl } from './url.js';

export const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 25_000;

const USER_AGENT = 'cooklang-web/0.0.1 (self-hosted recipe importer)';

export interface FetchedPage {
	/** Final URL after redirects. */
	url: string;
	html: string;
	contentType: string;
}

function isRedirect(status: number): boolean {
	return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isTextContentType(contentType: string): boolean {
	if (!contentType) return true;
	const type = contentType.toLowerCase();
	return (
		type.includes('text/html') ||
		type.includes('application/xhtml+xml') ||
		type.includes('text/plain') ||
		type.includes('application/json')
	);
}

async function readBodyWithLimit(response: Response, limit: number): Promise<Uint8Array> {
	const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10);
	if (Number.isFinite(declared) && declared > limit) {
		throw new ImportUrlError('The page is too large to import.');
	}

	if (!response.body) return new Uint8Array();

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;

			total += value.byteLength;
			if (total > limit) {
				await reader.cancel().catch(() => {});
				throw new ImportUrlError('The page is too large to import.');
			}

			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return bytes;
}

function decode(bytes: Uint8Array, contentType: string): string {
	const charset = /charset\s*=\s*"?([^\s;"]+)"?/iu.exec(contentType)?.[1];
	try {
		return new TextDecoder(charset ?? 'utf-8').decode(bytes);
	} catch {
		return new TextDecoder('utf-8').decode(bytes);
	}
}

/** Fetch a public page and return its HTML, following safe redirects. */
export async function fetchRecipePage(input: string): Promise<FetchedPage> {
	let url = parseImportUrl(input);

	for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
		await assertPublicHost(url);

		let response: Response;
		try {
			response = await fetch(url, {
				method: 'GET',
				redirect: 'manual',
				headers: {
					Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1',
					'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
					'User-Agent': USER_AGENT
				},
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch (error) {
			if (error instanceof Error && error.name === 'TimeoutError') {
				throw new ImportUrlError('The recipe page took too long to respond.');
			}
			throw new ImportUrlError('The recipe page could not be reached.');
		}

		if (isRedirect(response.status)) {
			const location = response.headers.get('location');
			if (!location) {
				throw new ImportUrlError('The recipe page redirected without saying where.');
			}

			try {
				url = parseImportUrl(new URL(location, url).href);
			} catch (error) {
				if (error instanceof ImportUrlError) throw error;
				throw new ImportUrlError('The recipe page redirected to an invalid URL.');
			}

			continue;
		}

		if (!response.ok) {
			throw new ImportUrlError(
				`The recipe page returned ${response.status}. Check that the URL is public and still works.`
			);
		}

		const contentType = response.headers.get('content-type') ?? '';
		if (!isTextContentType(contentType)) {
			throw new ImportUrlError('That URL is not an HTML page.');
		}

		const bytes = await readBodyWithLimit(response, MAX_PAGE_BYTES);
		const html = decode(bytes, contentType);
		if (!html.trim()) {
			throw new ImportUrlError('The recipe page was empty.');
		}

		return { url: url.href, html, contentType };
	}

	throw new ImportUrlError('The recipe page redirected too many times.');
}

export interface FetchedImage {
	bytes: Uint8Array;
	extension: ImageExtension;
}

/**
 * Download a recipe's cover image, with the same public-host and size bounds
 * as the page fetch.
 *
 * The format is detected from the bytes rather than the `Content-Type`, which
 * CDNs routinely get wrong. Importing an image is best-effort: callers may
 * still create the recipe without one.
 */
export async function fetchRecipeImage(input: string): Promise<FetchedImage> {
	let url = parseImportUrl(input);

	for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
		await assertPublicHost(url);

		let response: Response;
		try {
			response = await fetch(url, {
				method: 'GET',
				redirect: 'manual',
				headers: {
					Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.1',
					'User-Agent': USER_AGENT
				},
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch (error) {
			if (error instanceof Error && error.name === 'TimeoutError') {
				throw new ImportUrlError('The recipe image took too long to download.');
			}
			throw new ImportUrlError('The recipe image could not be downloaded.');
		}

		if (isRedirect(response.status)) {
			const location = response.headers.get('location');
			if (!location) {
				throw new ImportUrlError('The recipe image redirected without saying where.');
			}
			url = parseImportUrl(new URL(location, url).href);
			continue;
		}

		if (!response.ok) {
			throw new ImportUrlError(`The recipe image returned ${response.status}.`);
		}

		const bytes = await readBodyWithLimit(response, MAX_IMAGE_BYTES);
		const detected = detectImageType(bytes);

		if (!detected) {
			throw new ImportUrlError('The recipe image is not a JPEG, PNG or WebP file.');
		}

		return { bytes, extension: detected.extension };
	}

	throw new ImportUrlError('The recipe image redirected too many times.');
}
