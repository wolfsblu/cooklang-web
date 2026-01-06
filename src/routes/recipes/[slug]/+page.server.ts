import { CooklangParser, HTMLRenderer } from "@cooklang/cooklang";
import type { PageServerLoad } from "./$types";
import fs from 'node:fs/promises'

const readFile = async (filename: string) => {
    return fs.readFile(filename, { encoding: 'utf8' });
}

export const load: PageServerLoad = async ({ params }) => {
    const recipeFile = await readFile(`./recipes/${params.slug}`)

    const parser = new CooklangParser()
    const renderer = new HTMLRenderer()
    const [parsedRecipe, report] = parser.parse(recipeFile)
    const markup = renderer.render(parsedRecipe)
        
    const recipe = {
        filename: params.slug,
        content: recipeFile,
        markup, 
        report,
        parsed: structuredClone(parsedRecipe),
    }

    return {
        recipe
    }
}