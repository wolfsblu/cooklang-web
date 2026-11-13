<script lang="ts">
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import RecipeFilterForm from './RecipeFilterForm.svelte';

	/**
	 * The mobile filter panel. The controls themselves live in
	 * RecipeFilterForm, which the desktop sidebar also uses, so there is one
	 * definition of what each filter means.
	 */
	type Props = {
		isOpen: boolean;
		/** Facets come from the whole library, not the filtered view. */
		allTags: string[];
		allIngredients: string[];
		allCourses: string[];
	};

	let { isOpen = $bindable(), allTags, allIngredients, allCourses }: Props = $props();
</script>

<Drawer bind:open={isOpen} title="Filter recipes">
	<RecipeFilterForm {allTags} {allIngredients} {allCourses} />
</Drawer>
