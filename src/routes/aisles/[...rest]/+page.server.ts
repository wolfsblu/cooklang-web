import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The section moved under /ingredients, so old bookmarks and shared links keep
 * working instead of landing on a 404. Unknown subpaths fall back to the
 * section's new landing page.
 */
const MOVED: Record<string, string> = {
	'': '/ingredients/aisles',
	ingredients: '/ingredients',
	unassigned: '/ingredients/unassigned'
};

export const load: PageServerLoad = ({ params, url }) => {
	const target = MOVED[params.rest ?? ''] ?? '/ingredients/aisles';
	throw redirect(308, `${target}${url.search}`);
};
