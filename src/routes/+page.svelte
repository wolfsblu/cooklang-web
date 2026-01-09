<script lang="ts">
    import type { PageProps } from './$types'
    import RecipeCard from "$lib/components/recipes/RecipeCard.svelte";

    const {
        data
    }: PageProps = $props()
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {#each data.recipes as recipe}
        <RecipeCard {recipe} />
    {/each}
</div>
