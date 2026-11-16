/**
 * Health endpoint, used by the container healthcheck.
 *
 * Reports whether the recipe directory is actually readable rather than just
 * whether the process is alive: a missing or misconfigured volume mount is the
 * failure mode that otherwise looks like an empty library.
 */

import { spawn } from 'node:child_process';
import type { RequestHandler } from './$types';
import { config } from '#lib/server/config.js';
import { getIndex } from '#lib/server/recipes/index.js';
import { APP_COMMIT, APP_VERSION } from '#lib/server/version.js';

type CookCliInfo = {
	status: 'ok' | 'missing';
	version: string | null;
};

/** Whether the Cook CLI can be executed. Cached: this spawns a process. */
let cookCliInfo: CookCliInfo | null = null;

async function checkCookCli(): Promise<CookCliInfo> {
	if (cookCliInfo) return cookCliInfo;

	cookCliInfo = await new Promise<CookCliInfo>((resolve) => {
		const proc = spawn(config.COOK_CLI_PATH, ['--version']);
		let output = '';
		proc.stdout.setEncoding('utf8');
		proc.stdout.on('data', (chunk: string) => (output += chunk));
		proc.on('error', () => resolve({ status: 'missing', version: null }));
		proc.on('close', (code) =>
			resolve(
				code === 0
					? { status: 'ok', version: output.trim() || null }
					: { status: 'missing', version: null }
			)
		);
	});

	return cookCliInfo;
}

export const GET: RequestHandler = async () => {
	const [index, cookCli] = await Promise.all([getIndex(), checkCookCli()]);

	// The recipe directory being unreadable is the only fatal condition. A
	// missing Cook CLI degrades the shopping list but leaves the app usable, so
	// it is reported without failing the check.
	const ok = index.readable;

	return Response.json(
		{
			ok,
			version: APP_VERSION,
			commit: APP_COMMIT,
			recipePath: config.RECIPE_PATH,
			recipeCount: index.entries.length,
			cookCli: cookCli.status,
			cookCliVersion: cookCli.version
		},
		{ status: ok ? 200 : 503 }
	);
};
