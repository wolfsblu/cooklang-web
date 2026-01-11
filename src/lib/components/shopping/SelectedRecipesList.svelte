<script lang="ts">
	import { Trash2, Minus, Plus } from '@lucide/svelte';
	import type { RecipeSelection } from '$lib/types/shopping-list';

	interface Props {
		recipes: RecipeSelection[];
		onupdatescale: (slug: string, scale: number) => Promise<void> | void;
		onremove: (slug: string) => Promise<void> | void;
		onclear?: () => Promise<void> | void;
	}

	let { recipes, onupdatescale, onremove, onclear }: Props = $props();

	async function incrementScale(recipe: RecipeSelection) {
		await onupdatescale(recipe.slug, recipe.scale + 0.5);
	}

	async function decrementScale(recipe: RecipeSelection) {
		if (recipe.scale > 0.5) {
			await onupdatescale(recipe.slug, recipe.scale - 0.5);
		}
	}

	async function handleClear() {
		if (onclear) {
			if (confirm('Clear all recipes from shopping list?')) {
				await onclear();
			}
		}
	}
</script>

<div class="card preset-outlined-surface-200-800 p-4 space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="h4">Selected Recipes ({recipes.length})</h2>
		{#if onclear && recipes.length > 0}
			<button class="btn preset-tonal-error btn-sm" onclick={handleClear}>
				<Trash2 size={16} />
				Clear All
			</button>
		{/if}
	</div>

	{#if recipes.length === 0}
		<p class="text-surface-600-400 text-sm text-center py-4">
			No recipes selected. Add recipes from recipe pages.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each recipes as recipe (recipe.slug)}
				<li class="flex items-center justify-between gap-2 p-2 rounded hover:preset-tonal-surface-200-800">
					<div class="flex-1 min-w-0">
						<a href="/{recipe.slug.replace('.cook', '')}" class="anchor text-sm truncate block">
							{recipe.title}
						</a>
						{#if recipe.servings}
							<span class="text-xs text-surface-600-400">
								{recipe.servings} servings
							</span>
						{/if}
					</div>

					<div class="flex items-center gap-2 shrink-0">
						<!-- Scale control -->
						<div class="flex items-center gap-1 preset-outlined-surface-200-800 rounded px-2 py-1">
							<button
								class="btn-icon btn-icon-sm hover:preset-tonal-surface"
								onclick={() => decrementScale(recipe)}
								disabled={recipe.scale <= 0.5}
								title="Decrease scale"
							>
								<Minus size={14} />
							</button>
							<span class="text-sm font-mono min-w-[2.5rem] text-center">
								{recipe.scale}×
							</span>
							<button
								class="btn-icon btn-icon-sm hover:preset-tonal-surface"
								onclick={() => incrementScale(recipe)}
								title="Increase scale"
							>
								<Plus size={14} />
							</button>
						</div>

						<!-- Remove button -->
						<button
							class="btn-icon btn-icon-sm preset-tonal-error"
							onclick={() => onremove(recipe.slug)}
							title="Remove from list"
						>
							<Trash2 size={16} />
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
