/** A recipe import failure the page can explain to the user. */
export class RecipeImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RecipeImportError';
	}
}
