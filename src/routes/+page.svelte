<script lang="ts">
    import type { PageProps } from './$types'
    import RecipeCard from "$lib/components/recipes/RecipeCard.svelte";
    import RecipeFilters from "$lib/components/recipes/RecipeFilters.svelte";

    const {
        data
    }: PageProps = $props()
</script>

<div class="space-y-6">
    <!-- Search Bar and Sort -->
    <RecipeFilters />

    <!-- Recipe Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {#each data.recipes as recipe (recipe.filename)}
            <RecipeCard {recipe} />
        {/each}
    </div>
</div>
