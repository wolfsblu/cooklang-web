<script lang="ts">
	import { ShoppingCartIcon, TerminalIcon, TriangleAlertIcon } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import SelectedRecipesList from '$lib/components/shopping/SelectedRecipesList.svelte';
	import ShoppingListDisplay from '$lib/components/shopping/ShoppingListDisplay.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Page from '$lib/components/ui/Page.svelte';

	const { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Shopping list</title>
</svelte:head>

<Page full>
	<h1 class="sr-only">Shopping</h1>

	<!-- One workbench, not a stack of cards: the warnings, recipe pane and
	     shopping pane share a single frame with hairline dividers, the way the
	     recipe editor does. -->
	<div class="border-border bg-surface overflow-hidden rounded-lg border">
		{#if data.selections.length === 0}
			<EmptyState
				icon={ShoppingCartIcon}
				title="Your shopping list is empty"
				description="Open a recipe and add it to build a combined list, with quantities merged across recipes and anything in your pantry subtracted."
			>
				{#snippet actions()}
					<Button href="/">Browse recipes</Button>
				{/snippet}
			</EmptyState>
		{:else}
			{#if data.error}
				<div
					class="border-warn/30 bg-warn-soft text-warn-soft-fg flex items-start gap-3 border-b px-4 py-3"
				>
					<TerminalIcon class="mt-0.5 size-5 shrink-0" />
					<div class="max-w-4xl text-sm">
						<p class="font-semibold">
							{data.cliMissing ? 'Combined list unavailable' : 'Could not generate the list'}
						</p>
						<p class="mt-1">{data.error}</p>
						{#if data.cliMissing}
							<p class="mt-1">
								Your selected recipes are still listed; install the cook CLI to combine them.
							</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if data.warnings.length > 0}
				<div
					class="border-warn/30 bg-warn-soft text-warn-soft-fg flex items-start gap-3 border-b px-4 py-3"
				>
					<TriangleAlertIcon class="mt-0.5 size-5 shrink-0" />
					<div class="max-w-4xl min-w-0 text-sm">
						<p class="font-semibold">Some pantry items could not be applied</p>
						<ul class="mt-1 list-disc space-y-0.5 pl-4">
							{#each data.warnings as warning (warning)}
								<li>{warning}</li>
							{/each}
						</ul>
						<p class="mt-2">
							Stock is only subtracted when its unit matches the one the recipe uses; kilograms do
							not cover a recipe measured in grams. Edit the entry in your
							<a href="/pantry" class="link">pantry</a> to match, and it will be deducted.
						</p>
					</div>
				</div>
			{/if}

			<div class="grid lg:grid-cols-[22rem_1fr]">
				<aside
					class="border-border bg-surface-muted/40 order-2 border-t lg:order-1 lg:border-t-0 lg:border-r"
				>
					<SelectedRecipesList selections={data.selections} />
				</aside>

				<div class="order-1 min-w-0 lg:order-2">
					<ShoppingListDisplay shoppingList={data.list} aisleCategories={data.aisleCategories} />
				</div>
			</div>
		{/if}
	</div>
</Page>
