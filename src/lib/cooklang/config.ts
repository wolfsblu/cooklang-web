/**
 * Cook CLI and recipe path configuration
 */

import { env } from '$env/dynamic/private';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

/**
 * Resolve recipe path relative to project root if it's a relative path
 */
function resolveRecipePath(recipePath: string): string {
	if (path.isAbsolute(recipePath)) {
		return recipePath;
	}
	return path.resolve(projectRoot, recipePath);
}

export const config = {
	/**
	 * Path to the directory containing .cook recipe files
	 * Defaults to './recipes' if not specified
	 * Relative paths are resolved from project root
	 */
	RECIPE_PATH: resolveRecipePath(env.RECIPE_PATH || './recipes'),

	/**
	 * Path to the Cook CLI binary
	 * Defaults to 'cook' (expects it in PATH)
	 */
	COOK_CLI_PATH: env.COOK_CLI_PATH || 'cook',

	/**
	 * Timeout for Cook CLI subprocess execution in milliseconds
	 * Defaults to 30 seconds
	 */
	COOK_CLI_TIMEOUT: parseInt(env.COOK_CLI_TIMEOUT || '30000', 10),

	/**
	 * Path to aisle configuration file (optional)
	 * CLI will fall back to "other" category if not specified
	 */
	AISLE_CONFIG_PATH: env.AISLE_CONFIG_PATH || undefined
};
