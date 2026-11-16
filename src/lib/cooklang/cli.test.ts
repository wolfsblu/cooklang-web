import { describe, expect, it } from 'vitest';
import { parseWarnings } from './cli';

const ESC = '';

describe('parseWarnings', () => {
	it('extracts a warning from colourised output', () => {
		// Captured from cookcli 0.19.3 with 2kg of flour stocked against a recipe
		// measured in grams. The CLI declines to subtract and says so here only.
		const stderr = `${ESC}[33m WARN${ESC}[0m Unit mismatch for 'flour': recipe needs 'g', pantry has 'kg'\n`;

		expect(parseWarnings(stderr)).toEqual([
			"Unit mismatch for 'flour': recipe needs 'g', pantry has 'kg'"
		]);
	});

	it('turns the file-prefixed recipe warnings of newer CLI versions into the old shape', () => {
		// cookcli 0.41.1 prefixes a recipe diagnostic with its absolute path.
		const stderr = `${ESC}[33m WARN${ESC}[0m /srv/recipes/Breakfast/Easy Pancakes.cook: Unsupported value for key: 'servings'\n`;

		expect(parseWarnings(stderr)).toEqual([
			"Recipe 'Easy Pancakes': Unsupported value for key: 'servings'"
		]);
	});

	it('keeps config warnings recognisable without exposing their absolute path', () => {
		const stderr = [
			' WARN /srv/recipes/config/aisle.conf: aisle configuration: Ingredient found before any category',
			' WARN /srv/recipes/config/pantry.conf: pantry configuration: unknown attribute'
		].join('\n');

		expect(parseWarnings(stderr)).toEqual([
			'aisle.conf: aisle configuration: Ingredient found before any category',
			'pantry.conf: pantry configuration: unknown attribute'
		]);
	});

	it('does not rewrite prose that happens to mention a file', () => {
		const stderr =
			' WARN Failed to read pantry file at /srv/recipes/config/pantry.conf: permission denied\n';

		expect(parseWarnings(stderr)).toEqual([
			'Failed to read pantry file at /srv/recipes/config/pantry.conf: permission denied'
		]);
	});

	it('leaves warnings without a file prefix alone', () => {
		const stderr =
			" WARN Unit mismatch for 'flour': recipe needs 'g', pantry has 'kg'\n" +
			" WARN Recipe 'Easy Pancakes': Unsupported value for key: 'servings'\n";

		expect(parseWarnings(stderr)).toEqual([
			"Unit mismatch for 'flour': recipe needs 'g', pantry has 'kg'",
			"Recipe 'Easy Pancakes': Unsupported value for key: 'servings'"
		]);
	});

	it('rejoins a warning wrapped onto an indented continuation line', () => {
		const stderr = `${ESC}[33m WARN${ESC}[0m Unit mismatch for 'flour': recipe needs 'g'\n    pantry has 'kg'\n`;

		expect(parseWarnings(stderr)).toEqual([
			"Unit mismatch for 'flour': recipe needs 'g' pantry has 'kg'"
		]);
	});

	it('collects several warnings and drops duplicates', () => {
		const stderr = [
			" WARN Unit mismatch for 'salt'",
			" WARN Unit mismatch for 'flour'",
			" WARN Unit mismatch for 'salt'"
		].join('\n');

		expect(parseWarnings(stderr)).toEqual([
			"Unit mismatch for 'salt'",
			"Unit mismatch for 'flour'"
		]);
	});

	it('ignores output with no warnings', () => {
		expect(parseWarnings('')).toEqual([]);
		expect(parseWarnings('Loading pantry from: /recipes/config/pantry.conf\n')).toEqual([]);
	});
});
