<script lang="ts">
	import { ShoppingCart, Check, X, Plus } from '@lucide/svelte';
	import { shoppingListStore } from '$lib/stores/shopping-list.svelte';
	import type { RecipeSelection } from '$lib/types/shopping-list';

	interface Props {
		recipe: Omit<RecipeSelection, 'scale'>; // Recipe without scale (we'll add it)
		compact?: boolean; // Compact mode for cards
	}

	let { recipe, compact = false }: Props = $props();

	// Check if recipe is in shopping list
	let inList = $derived(shoppingListStore.hasRecipe(recipe.slug));
	let currentRecipe = $derived(shoppingListStore.getRecipe(recipe.slug));
	let currentScale = $derived(currentRecipe?.scale ?? 1);

	// Show scale dropdown
	let showScaleMenu = $state(false);

	async function addWithScale(scale: number) {
		await shoppingListStore.addRecipe({
			...recipe,
			scale
		});
		showScaleMenu = false;
	}

	async function remove() {
		await shoppingListStore.removeRecipe(recipe.slug);
	}

	function toggleScaleMenu() {
		showScaleMenu = !showScaleMenu;
	}
</script>

{#if inList}
	<!-- Recipe is in shopping list -->
	<div class="flex items-center gap-2">
		{#if compact}
			<button
				class="btn preset-tonal-success btn-sm"
				onclick={toggleScaleMenu}
				title="In shopping list ({currentScale}×)"
			>
				<Check size={16} />
				<span>{currentScale}×</span>
			</button>
			<button class="btn preset-tonal-error btn-sm" onclick={remove} title="Remove from shopping list">
				<X size={16} />
			</button>
		{:else}
			<button class="btn preset-tonal-success" onclick={toggleScaleMenu}>
				<Check size={20} />
				<span>In Shopping List ({currentScale}×)</span>
			</button>
			<button class="btn preset-tonal-error" onclick={remove}>
				<X size={20} />
				Remove
			</button>
		{/if}
	</div>
{:else}
	<!-- Recipe is not in shopping list -->
	<div class="relative">
		<button
			class="btn preset-filled-primary-500"
			onclick={toggleScaleMenu}
		>
			<ShoppingCart size={compact ? 16 : 20} />
			{#if !compact}
				<span>Add to Shopping List</span>
			{/if}
		</button>

		{#if showScaleMenu}
			<div
				class="absolute z-10 mt-2 card preset-outlined-surface-200-800 p-2 space-y-1 min-w-[120px]"
			>
				<button
					class="btn preset-tonal-primary btn-sm w-full justify-start"
					onclick={() => addWithScale(1)}
				>
					1× servings
				</button>
				<button
					class="btn preset-tonal-primary btn-sm w-full justify-start"
					onclick={() => addWithScale(2)}
				>
					2× servings
				</button>
				<button
					class="btn preset-tonal-primary btn-sm w-full justify-start"
					onclick={() => addWithScale(3)}
				>
					3× servings
				</button>
				<hr class="opacity-20" />
				<button
					class="btn preset-tonal-surface btn-sm w-full justify-start"
					onclick={() => (showScaleMenu = false)}
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
{/if}

<!-- Click outside to close menu -->
{#if showScaleMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-0" onclick={() => (showScaleMenu = false)}></div>
{/if}
