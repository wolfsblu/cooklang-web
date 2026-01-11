/**
 * Cook CLI wrapper for executing shopping list generation
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from './config.js';
import type { CookCLIShoppingList } from './types.js';

/**
 * Recipe selection input for shopping list generation
 */
export interface RecipeInput {
	slug: string;
	scale: number;
}

/**
 * Error thrown when Cook CLI execution fails
 */
export class CookCLIError extends Error {
	constructor(
		message: string,
		public readonly stderr?: string,
		public readonly exitCode?: number
	) {
		super(message);
		this.name = 'CookCLIError';
	}
}

/**
 * Get the absolute recipe path
 */
export function getRecipePath(): string {
	return path.resolve(config.RECIPE_PATH);
}

/**
 * Build the CLI arguments for shopping list generation
 * Example: ["shopping-list", "recipe1.cook:2", "recipe2.cook", "-f", "json"]
 */
function buildCLIArgs(recipes: RecipeInput[]): string[] {
	const args: string[] = ['shopping-list'];

	// Add recipe arguments with optional scaling
	for (const recipe of recipes) {
		const recipeArg = recipe.scale !== 1 ? `${recipe.slug}:${recipe.scale}` : recipe.slug;
		args.push(recipeArg);
	}

	// Add JSON format flag
	args.push('-f', 'json');

	// Add aisle config if specified
	if (config.AISLE_CONFIG_PATH) {
		args.push('-a', config.AISLE_CONFIG_PATH);
	}

	return args;
}

/**
 * Execute Cook CLI command and return parsed JSON output
 */
async function executeCookCLI(args: string[]): Promise<CookCLIShoppingList> {
	return new Promise((resolve, reject) => {
		const recipePath = getRecipePath();

		// Spawn the Cook CLI process
		const proc = spawn(config.COOK_CLI_PATH, args, {
			cwd: recipePath,
			env: process.env
		});

		let stdout = '';
		let stderr = '';

		// Collect stdout
		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		// Collect stderr
		proc.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		// Set timeout
		const timeout = setTimeout(() => {
			proc.kill('SIGTERM');
			reject(
				new CookCLIError(
					`Cook CLI execution timed out after ${config.COOK_CLI_TIMEOUT}ms`,
					stderr
				)
			);
		}, config.COOK_CLI_TIMEOUT);

		// Handle process completion
		proc.on('close', (code) => {
			clearTimeout(timeout);

			if (code !== 0) {
				reject(
					new CookCLIError(
						`Cook CLI exited with code ${code}`,
						stderr,
						code || undefined
					)
				);
				return;
			}

			// Parse JSON output
			try {
				const parsed = JSON.parse(stdout) as CookCLIShoppingList;
				resolve(parsed);
			} catch (error) {
				reject(
					new CookCLIError(
						`Failed to parse Cook CLI JSON output: ${error instanceof Error ? error.message : 'Unknown error'}`,
						stderr
					)
				);
			}
		});

		// Handle process errors (e.g., command not found)
		proc.on('error', (error) => {
			clearTimeout(timeout);
			reject(
				new CookCLIError(
					`Failed to execute Cook CLI: ${error.message}. Is Cook CLI installed and in PATH?`,
					stderr
				)
			);
		});
	});
}

/**
 * Generate a shopping list from multiple recipes
 *
 * @param recipes - Array of recipes with slugs and scales
 * @returns Promise resolving to Cook CLI shopping list JSON output
 * @throws {CookCLIError} If CLI execution fails
 *
 * @example
 * const list = await generateShoppingList([
 *   { slug: 'Easy Pancakes.cook', scale: 2 },
 *   { slug: 'lamb-chops.cook', scale: 1 }
 * ]);
 */
export async function generateShoppingList(recipes: RecipeInput[]): Promise<CookCLIShoppingList> {
	if (recipes.length === 0) {
		return [];
	}

	const args = buildCLIArgs(recipes);
	return executeCookCLI(args);
}
