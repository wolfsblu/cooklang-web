import { describe, expect, it } from 'vitest';
import { isPrivateAddress, parseImportUrl } from './url';

describe('parseImportUrl', () => {
	it('accepts ordinary public http(s) URLs', () => {
		expect(parseImportUrl('https://www.chefkoch.de/rezepte/1/Test.html').hostname).toBe(
			'www.chefkoch.de'
		);
		expect(parseImportUrl('http://example.org/recipe').protocol).toBe('http:');
	});

	it('rejects missing schemes and non-http protocols', () => {
		expect(() => parseImportUrl('www.example.org/recipe')).toThrow(/valid URL/i);
		expect(() => parseImportUrl('file:///etc/passwd')).toThrow(/http and https/i);
		expect(() => parseImportUrl('ftp://example.org/recipe')).toThrow(/http and https/i);
	});

	it('rejects credentials in the URL', () => {
		expect(() => parseImportUrl('https://user:pass@example.org/recipe')).toThrow(
			/username or password/i
		);
	});

	it('rejects localhost, private suffixes and private IP literals', () => {
		expect(() => parseImportUrl('http://localhost:3000/recipe')).toThrow(/public internet/i);
		expect(() => parseImportUrl('http://nas.local/recipe')).toThrow(/public internet/i);
		expect(() => parseImportUrl('http://192.168.1.10/recipe')).toThrow(/Private and local/i);
		expect(() => parseImportUrl('http://[::1]/recipe')).toThrow(/Private and local/i);
		expect(() => parseImportUrl('http://169.254.169.254/latest/meta-data')).toThrow(
			/Private and local/i
		);
	});
});

describe('isPrivateAddress', () => {
	it('classifies IPv4 private, link-local, loopback and CGNAT ranges', () => {
		for (const address of [
			'0.0.0.0',
			'10.1.2.3',
			'100.64.0.1',
			'127.0.0.1',
			'169.254.1.1',
			'172.16.0.1',
			'172.31.255.255',
			'192.168.0.1',
			'198.18.0.1',
			'224.0.0.1',
			'255.255.255.255'
		]) {
			expect(isPrivateAddress(address), address).toBe(true);
		}
	});

	it('allows public IPv4 addresses', () => {
		for (const address of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.32.0.1']) {
			expect(isPrivateAddress(address), address).toBe(false);
		}
	});

	it('classifies IPv6 loopback, unique-local, link-local and mapped IPv4', () => {
		for (const address of ['::1', '::', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1']) {
			expect(isPrivateAddress(address), address).toBe(true);
		}
		expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
	});
});
