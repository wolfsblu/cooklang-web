import { Parser } from '@cooklang/cooklang';

const source = `
>> servings: 4
Add @salt and @pepper to taste.
`;

export const getRecipes = () => {
    const parser = new Parser();
    const recipe = parser.parse(source);
}

// getImageURL() not available - use custom helper
export const getImageURL = (name: string, options?: { step?: number; extension?: 'png' | 'jpg' }) => {
  const ext = options?.extension || 'png';
  const step = options?.step ? `.${options.step}` : '';
  return `${name}${step}.${ext}`;
}