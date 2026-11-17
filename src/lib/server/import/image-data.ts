/**
 * Encode an uploaded photo for a multimodal chat request.
 *
 * The bytes are sniffed and inlined as a data URL. That keeps the upload on
 * this server and out of any temporary public hosting, which matters for a
 * self-hosted app behind a home connection.
 */

import { Buffer } from 'node:buffer';
import { detectImageType, isHeif, type DetectedImage } from '../recipes/image.js';

/** Largest photo accepted for one import. The client downscales before sending. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

/**
 * Validate the uploaded bytes the same way cover uploads are validated.
 *
 * Browsers cannot render HEIC, but the error is worth calling out explicitly:
 * the client converts it when it can, so a HEIC file reaching the server means
 * the browser could not decode it.
 */
export function detectPhotoImage(bytes: Uint8Array): DetectedImage | null {
	return detectImageType(bytes);
}

export function photoFormatMessage(bytes: Uint8Array): string {
	return isHeif(bytes)
		? 'HEIC and HEIF photos cannot be read here. Export the photo as a JPEG and try again.'
		: 'Choose a JPEG, PNG or WebP image.';
}

export function photoDataUrl(bytes: Uint8Array, mimeType: string): string {
	return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}
