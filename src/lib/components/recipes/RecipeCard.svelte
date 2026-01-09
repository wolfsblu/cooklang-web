<script lang="ts">
    import type { CooklangRecipe } from "@cooklang/cooklang";
    import { UsersIcon, ClockIcon } from '@lucide/svelte';

const imgSrc =
	'https://images.unsplash.com/photo-1463171515643-952cee54d42a?q=80&w=450&h=190&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

	interface Props {
		recipe: {
			filename: string
			content: string
			markup: string
			report: string
			parsed: CooklangRecipe
		}
	}

	const {
		recipe
	}: Props = $props()

	const url = `/${recipe.filename}`

	// Format time for display
	const timeDisplay = $derived(() => {
		if (!recipe.parsed.time) return null;
		if (typeof recipe.parsed.time === 'number') {
			return `${recipe.parsed.time}m`;
		}
		const total = (recipe.parsed.time.prep_time || 0) + (recipe.parsed.time.cook_time || 0);
		return total > 0 ? `${total}m` : null;
	});
</script>
<a
	href={url}
	class="card preset-filled-surface-100-900 border border-surface-200-800 card-hover divide-surface-200-800 block divide-y overflow-hidden"
>
	<header class="relative">
		<img src={imgSrc} class="aspect-21/9 w-full grayscale hue-rotate-90" alt="banner" />

		<!-- Servings overlay -->
		{#if recipe.parsed.servings}
			<div class="absolute top-2 left-2 flex items-center gap-1 bg-surface-900/80 text-white px-2 py-1 rounded text-xs">
				<UsersIcon class="size-3" />
				<span>{recipe.parsed.servings}</span>
			</div>
		{/if}

		<!-- Time overlay -->
		{#if timeDisplay()}
			<div class="absolute top-2 right-2 flex items-center gap-1 bg-surface-900/80 text-white px-2 py-1 rounded text-xs">
				<ClockIcon class="size-3" />
				<span>{timeDisplay()}</span>
			</div>
		{/if}
	</header>

    <article class="space-y-2 p-2">
        <h1 class="h5">{recipe.parsed.title}</h1>
	</article>

    <footer class="flex items-center justify-between gap-2 p-2">
		{#if recipe.parsed.tags.size > 0}
            <div class="flex gap-1 overflow-x-auto flex-1 min-w-0">
                {#each Array.from(recipe.parsed.tags) as tag}
                    <span class="badge preset-filled-surface-200-800 text-xs whitespace-nowrap">{tag}</span>
                {/each}
            </div>
        {:else}
            <span></span>
        {/if}
		{#if recipe.parsed.course}
			<small class="opacity-60 whitespace-nowrap capitalize">{recipe.parsed.course}</small>
		{/if}
	</footer>
</a>