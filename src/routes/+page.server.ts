import { CooklangParser, getFlatIngredients, HTMLRenderer } from "@cooklang/cooklang";
import type { PageServerLoad } from "./$types";
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '$env/dynamic/private';

const readFiles = async (directory: string, extension: string) => {
    const files = await fs.readdir(directory);
    const matchedFiles = files.filter(file => path.extname(file) === extension);

    return Promise.all(
        matchedFiles.map(async (file) => {
            const filePath = path.join(directory, file);
            const content = await fs.readFile(filePath, 'utf8');
            return { filename: file, content: content };
        })
    );
}

export const load: PageServerLoad = async () => {
    const recipePath = env.RECIPE_PATH || './recipes';

    try {
        const recipeFiles = await readFiles(recipePath, ".cook")

        const parser = new CooklangParser()
        const renderer = new HTMLRenderer()
        const recipes = recipeFiles.map(file => {
            const [recipe, report] = parser.parse(file.content)
            const markup = renderer.render(recipe)

            return {
                filename: file.filename,
                content: file.content,
                markup,
                report,
                parsed: structuredClone(recipe),
                imageUrl: `/api/recipes/${file.filename}/image`
            }
        })

        return {
            recipes
        }
    } catch (error) {
        console.error('Failed to read recipes directory:', error);
        return {
            recipes: [],
            error: `Unable to load recipes from "${recipePath}". Please check that the directory exists.`
        };
    }
}
