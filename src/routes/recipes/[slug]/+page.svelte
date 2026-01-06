<script lang="ts">
    import type { PageProps } from "./$types";

    const {
        data
    }: PageProps = $props()
</script>

<p>Recipe</p>
{@html data.recipe.markup}