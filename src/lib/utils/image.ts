/**
 * Browser-side image preparation for uploads.
 *
 * Phone photos are far larger than either the AI provider or a cover image
 * needs, and iPhones hand over HEIC files that most browsers cannot display.
 * Both are fixed here, in one place, before the bytes leave the browser.
 */

/** Largest source file accepted before downscaling. */
export const MAX_SOURCE_PHOTO_BYTES = 40 * 1024 * 1024;

/** Long edge used for a photo sent to the vision model. */
export const PHOTO_IMPORT_MAX_EDGE = 2048;

/** Below this size an already-modern photo is sent untouched. */
const KEEP_ORIGINAL_BYTES = 5 * 1024 * 1024;

const HEIC_TYPE = /^image\/hei[cf]/iu;
const HEIC_NAME = /\.(heic|heif)$/iu;

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export function isHeic(file: File): boolean {
	return HEIC_TYPE.test(file.type) || HEIC_NAME.test(file.name);
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
	const url = URL.createObjectURL(file);

	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('The image could not be decoded'));
		};
		image.src = url;
	}).finally(() => {
		// The image element keeps its decoded bitmap after the URL is revoked,
		// so callers can still draw it to a canvas.
		URL.revokeObjectURL(url);
	});
}

export interface PreparedImage {
	file: File;
	width: number;
	height: number;
	/** True when the bytes were re-encoded rather than sent as uploaded. */
	converted: boolean;
}

async function reencode(
	image: HTMLImageElement,
	file: File,
	maxEdge: number,
	quality: number
): Promise<PreparedImage> {
	const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
	const width = Math.max(1, Math.round(image.naturalWidth * scale));
	const height = Math.max(1, Math.round(image.naturalHeight * scale));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas is unavailable');

	// JPEG has no alpha channel; without this a transparent PNG turns black.
	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, width, height);
	context.drawImage(image, 0, 0, width, height);

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/jpeg', quality)
	);
	if (!blob) throw new Error('The image could not be encoded');

	const stem = file.name.replace(/\.[^.]+$/u, '') || 'recipe-photo';
	return {
		file: new File([blob], `${stem}.jpg`, { type: 'image/jpeg' }),
		width,
		height,
		converted: true
	};
}

/**
 * Downscale and normalise a photo for an AI import.
 *
 * Modern formats already small enough are returned untouched, which avoids a
 * needless generation loss on a screenshot. Everything else -- including every
 * HEIC photo -- becomes a JPEG with a 2048 px long edge, which is plenty for
 * reading a recipe and small enough to upload comfortably.
 */
export async function prepareImportImage(
	file: File,
	maxEdge = PHOTO_IMPORT_MAX_EDGE
): Promise<PreparedImage> {
	if (file.size === 0) throw new Error('That file is empty');

	if (file.size > MAX_SOURCE_PHOTO_BYTES) {
		throw new Error(
			`That photo is ${formatBytes(file.size)}. Choose one under ${formatBytes(MAX_SOURCE_PHOTO_BYTES)}.`
		);
	}

	let image: HTMLImageElement;
	try {
		image = await loadImage(file);
	} catch {
		throw new Error(
			isHeic(file)
				? 'This browser could not read the HEIC photo. Export it as a JPEG (or take the photo in Most Compatible mode) and try again.'
				: 'That file is not an image the browser can read.'
		);
	}

	const width = image.naturalWidth;
	const height = image.naturalHeight;
	if (!width || !height) throw new Error('That image has no readable dimensions');

	const modern = !isHeic(file) && /^image\/(jpeg|png|webp)$/iu.test(file.type);
	const smallEnough = Math.max(width, height) <= maxEdge && file.size <= KEEP_ORIGINAL_BYTES;

	if (modern && smallEnough) {
		return { file, width, height, converted: false };
	}

	return reencode(image, file, maxEdge, 0.9);
}

/**
 * Convert an Apple photo to JPEG in the browser.
 *
 * Safari can decode HEIC, so an iPhone or Mac user never has to think about
 * formats. Browsers that cannot decode it reject in `prepareImportImage`, and
 * the server also refuses the raw file rather than storing something half the
 * web cannot display.
 */
export async function convertHeicToJpeg(file: File, maxEdge = 2560): Promise<File> {
	const image = await loadImage(file);
	return (await reencode(image, file, maxEdge, 0.9)).file;
}
