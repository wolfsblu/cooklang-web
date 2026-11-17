import { describe, expect, it } from 'vitest';
import { photoDataUrl, photoFormatMessage } from './image-data';

function heicBytes(): Uint8Array {
	const bytes = new Uint8Array(12);
	bytes.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
	bytes.set([0x68, 0x65, 0x69, 0x63], 8); // heic
	return bytes;
}

describe('photoDataUrl', () => {
	it('inlines the bytes with the detected MIME type', () => {
		expect(photoDataUrl(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg')).toBe(
			'data:image/jpeg;base64,/9j/'
		);
	});
});

describe('photoFormatMessage', () => {
	it('names HEIC explicitly instead of the generic format list', () => {
		expect(photoFormatMessage(heicBytes())).toContain('HEIC');
	});

	it('asks for a supported format for anything else', () => {
		expect(photoFormatMessage(new Uint8Array([0x00]))).toBe('Choose a JPEG, PNG or WebP image.');
	});
});
