<script lang="ts">
	import { shoppingListStore } from '$lib/stores/shopping-list.svelte';

	// Test data
	const testRecipe = {
		slug: 'lamb-chops.cook',
		title: 'Lamb Chops',
		scale: 1,
		servings: 2
	};

	async function testLoad() {
		console.log('Testing load()...');
		await shoppingListStore.load();
		console.log('Recipes:', shoppingListStore.recipes);
		console.log('Shopping list:', shoppingListStore.list);
	}

	async function testAdd() {
		console.log('Testing addRecipe()...');
		await shoppingListStore.addRecipe(testRecipe);
		console.log('Recipes:', shoppingListStore.recipes);
	}

	async function testUpdateScale() {
		console.log('Testing updateScale()...');
		await shoppingListStore.updateScale('lamb-chops.cook', 3);
		console.log('Recipes:', shoppingListStore.recipes);
	}

	async function testRemove() {
		console.log('Testing removeRecipe()...');
		await shoppingListStore.removeRecipe('lamb-chops.cook');
		console.log('Recipes:', shoppingListStore.recipes);
	}

	async function testClear() {
		console.log('Testing clear()...');
		await shoppingListStore.clear();
		console.log('Recipes:', shoppingListStore.recipes);
	}
</script>

<div class="container mx-auto p-8 space-y-4">
	<h1 class="h1">Shopping List Store Test</h1>

	<div class="card p-4 space-y-2">
		<h2 class="h3">Store State</h2>
		<div class="space-y-1 font-mono text-sm">
			<p>Loading: {shoppingListStore.isLoading}</p>
			<p>Error: {shoppingListStore.errorMessage || 'null'}</p>
			<p>Recipes count: {shoppingListStore.recipes.length}</p>
			<p>Has shopping list: {shoppingListStore.list !== null}</p>
		</div>
	</div>

	<div class="card p-4 space-y-2">
		<h2 class="h3">Test Actions</h2>
		<div class="flex flex-wrap gap-2">
			<button class="btn preset-filled-primary" onclick={testLoad}>Load</button>
			<button class="btn preset-filled-primary" onclick={testAdd}>Add Recipe</button>
			<button class="btn preset-filled-primary" onclick={testUpdateScale}>Update Scale</button>
			<button class="btn preset-filled-primary" onclick={testRemove}>Remove Recipe</button>
			<button class="btn preset-filled-error" onclick={testClear}>Clear All</button>
		</div>
	</div>

	{#if shoppingListStore.recipes.length > 0}
		<div class="card p-4 space-y-2">
			<h2 class="h3">Selected Recipes</h2>
			<ul class="space-y-1">
				{#each shoppingListStore.recipes as recipe}
					<li class="font-mono text-sm">
						{recipe.title} (scale: {recipe.scale}×)
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if shoppingListStore.list}
		<div class="card p-4 space-y-2">
			<h2 class="h3">Shopping List ({shoppingListStore.list.totalItems} items)</h2>
			{#each shoppingListStore.list.categories as category}
				<div class="space-y-1">
					<h3 class="h4">{category.displayName}</h3>
					<ul class="list-disc list-inside ml-4">
						{#each category.items as item}
							<li class="text-sm">
								{item.displayName}
								{#if item.quantity}
									— {item.quantity}
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</div>
