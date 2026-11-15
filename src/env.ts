/**
 * Environment variables, declared so SvelteKit can type and validate them.
 *
 * Every value is read at runtime (the default), not inlined at build time, so
 * the container can be reconfigured without rebuilding. All of them are
 * optional: `lib/server/config.ts` supplies the defaults.
 */

import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	/** Directory holding .cook files. Mounted from the NAS in production. */
	RECIPE_PATH: { schema: (value) => value },

	/** Cook CLI binary. Expected on PATH unless overridden. */
	COOK_CLI_PATH: { schema: (value) => value },

	/** Timeout for Cook CLI subprocesses, in milliseconds. */
	COOK_CLI_TIMEOUT: { schema: (value) => value },

	/** How long the recipe index may serve results before re-stat'ing the recipe directory. */
	RECIPE_INDEX_TTL_MS: { schema: (value) => value },

	/** imgproxy base URL. Image proxying is disabled when this is unset. */
	IMGPROXY_BASE_URL: { schema: (value) => value },

	/** imgproxy signing key. */
	IMGPROXY_KEY: { schema: (value) => value },

	/** imgproxy signing salt. */
	IMGPROXY_SALT: { schema: (value) => value }
});
