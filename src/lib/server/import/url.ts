/**
 * URL validation for the recipe importer.
 *
 * The URL comes from a person using a self-hosted app, but the server does the
 * fetching, so it must not become a way to read the NAS, localhost, or cloud
 * metadata. Redirects are validated by the fetcher as they happen; this module
 * provides the single-URL checks it reuses.
 */

import { lookup } from 'node:dns/promises';
import net from 'node:net';

export class ImportUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImportUrlError';
	}
}

const BLOCKED_HOST_SUFFIXES = [
	'localhost',
	'.localhost',
	'.local',
	'.localdomain',
	'.internal',
	'.intranet',
	'.lan',
	'.home',
	'.home.arpa',
	'.corp',
	'.test',
	'.invalid',
	'.example',
	'.onion'
];

function ipv4ToNumber(address: string): number | null {
	const parts = address.split('.');
	if (parts.length !== 4) return null;

	let result = 0;
	for (const part of parts) {
		if (!/^\d{1,3}$/u.test(part)) return null;
		const value = Number.parseInt(part, 10);
		if (value > 255) return null;
		result = result * 256 + value;
	}

	return result >>> 0;
}

function isPrivateIpv4(address: string): boolean {
	const value = ipv4ToNumber(address);
	if (value === null) return true;

	// 0.0.0.0/8, 10/8, 100.64/10 (CGNAT), 127/8, 169.254/16, 172.16/12,
	// 192.168/16, 198.18/15 (benchmarking), and multicast/reserved space.
	const inRange = (start: string, prefix: number): boolean => {
		const startValue = ipv4ToNumber(start);
		if (startValue === null) return false;
		const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
		return (value & mask) === (startValue & mask);
	};

	return (
		inRange('0.0.0.0', 8) ||
		inRange('10.0.0.0', 8) ||
		inRange('100.64.0.0', 10) ||
		inRange('127.0.0.0', 8) ||
		inRange('169.254.0.0', 16) ||
		inRange('172.16.0.0', 12) ||
		inRange('192.0.0.0', 24) ||
		inRange('192.0.2.0', 24) ||
		inRange('192.168.0.0', 16) ||
		inRange('198.18.0.0', 15) ||
		inRange('198.51.100.0', 24) ||
		inRange('203.0.113.0', 24) ||
		inRange('224.0.0.0', 4) ||
		inRange('240.0.0.0', 4)
	);
}

function isPrivateIpv6(address: string): boolean {
	const normalized = address.toLowerCase().split('%')[0];

	// IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible forms.
	const mapped = /(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/u.exec(normalized);
	if (mapped) return isPrivateIpv4(mapped[1]);

	if (normalized === '::' || normalized === '::1') return true;
	if (/^f[cd]/u.test(normalized)) return true; // unique local fc00::/7
	if (/^fe[89ab]/u.test(normalized)) return true; // link-local fe80::/10
	if (/^fe[c-f]/u.test(normalized)) return true; // deprecated site-local
	if (/^ff/u.test(normalized)) return true; // multicast ff00::/8
	if (/^2001:db8:/u.test(normalized)) return true; // documentation
	if (/^2001:10:/u.test(normalized)) return true; // ORCHID
	if (/^64:ff9b:/u.test(normalized)) return true; // NAT64

	return false;
}

/** Whether an IP literal points somewhere the public internet cannot reach. */
export function isPrivateAddress(address: string): boolean {
	const family = net.isIP(address);
	if (family === 4) return isPrivateIpv4(address);
	if (family === 6) return isPrivateIpv6(address);
	return true;
}

function bareHostname(hostname: string): string {
	return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function isBlockedHostname(hostname: string): boolean {
	const host = bareHostname(hostname).toLowerCase().replace(/\.$/u, '');
	return BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(suffix));
}

/**
 * Parse and sanity-check a user-supplied URL.
 *
 * DNS resolution happens separately in `assertPublicHost`, because redirects
 * need the same check after each hop.
 */
export function parseImportUrl(input: string): URL {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		throw new ImportUrlError('Enter a valid URL, including http:// or https://.');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new ImportUrlError('Only http and https URLs can be imported.');
	}

	if (url.username || url.password) {
		throw new ImportUrlError('URLs with a username or password are not supported.');
	}

	if (!url.hostname) {
		throw new ImportUrlError('The URL has no host name.');
	}

	if (isBlockedHostname(url.hostname)) {
		throw new ImportUrlError('That host is not reachable from the public internet.');
	}

	const hostname = bareHostname(url.hostname);

	if (net.isIP(hostname) && isPrivateAddress(hostname)) {
		throw new ImportUrlError('Private and local network addresses cannot be imported.');
	}

	return url;
}

/**
 * Resolve the host and refuse if any address is private.
 *
 * Rebinding between this lookup and fetch is still theoretically possible on a
 * network an attacker controls; for a self-hosted recipe importer the useful
 * protection is against accidental localhost/NAS URLs and ordinary hostile
 * links, not a full egress proxy.
 */
export async function assertPublicHost(url: URL): Promise<void> {
	const hostname = bareHostname(url.hostname);

	if (net.isIP(hostname)) {
		if (isPrivateAddress(hostname)) {
			throw new ImportUrlError('Private and local network addresses cannot be imported.');
		}
		return;
	}

	let addresses;
	try {
		addresses = await lookup(hostname, { all: true, verbatim: true });
	} catch {
		throw new ImportUrlError(`Could not resolve the host "${hostname}".`);
	}

	if (addresses.length === 0) {
		throw new ImportUrlError(`Could not resolve the host "${hostname}".`);
	}

	if (addresses.some((entry) => isPrivateAddress(entry.address))) {
		throw new ImportUrlError('That URL resolves to a private or local network address.');
	}
}
