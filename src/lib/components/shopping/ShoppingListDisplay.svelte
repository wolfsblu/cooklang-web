<script lang="ts">
	import { Loader2 } from '@lucide/svelte';
	import type { ShoppingListDisplay } from '$lib/types/shopping-list';

	interface Props {
		shoppingList: ShoppingListDisplay | null;
		loading?: boolean;
	}

	let { shoppingList, loading = false }: Props = $props();
</script>

<div class="card preset-outlined-surface-200-800 p-6 space-y-6">
	{#if loading}
		<!-- Loading state -->
		<div class="flex items-center justify-center py-12">
			<Loader2 size={32} class="animate-spin text-primary-500" />
			<span class="ml-3 text-surface-600-400">Generating shopping list...</span>
		</div>
	{:else if !shoppingList}
		<!-- Empty state -->
		<div class="text-center py-12">
			<p class="text-surface-600-400">
				Add recipes to generate a shopping list
			</p>
		</div>
	{:else}
		<!-- Shopping list header -->
		<div class="flex items-center justify-between">
			<h2 class="h3">Shopping List</h2>
			<div class="text-sm text-surface-600-400">
				{shoppingList.totalItems} items from {shoppingList.recipeCount}
				{shoppingList.recipeCount === 1 ? 'recipe' : 'recipes'}
			</div>
		</div>

		<!-- Categories -->
		<div class="space-y-6">
			{#each shoppingList.categories as category (category.name)}
				<div class="space-y-3">
					<h3 class="h4 flex items-center gap-2">
						{category.displayName}
						<span class="text-xs preset-tonal-surface px-2 py-1 rounded">
							{category.items.length}
						</span>
					</h3>
					<ul class="space-y-2 ml-2">
						{#each category.items as item (item.name)}
							<li class="flex items-baseline gap-2">
								<span class="text-primary-500">•</span>
								<span class="flex-1">
									{item.displayName}
									{#if item.quantity}
										<span class="text-surface-600-400">— {item.quantity}</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		{#if shoppingList.categories.length === 0}
			<div class="text-center py-8">
				<p class="text-surface-600-400">
					No ingredients found in selected recipes
				</p>
			</div>
		{/if}
	{/if}
</div>
