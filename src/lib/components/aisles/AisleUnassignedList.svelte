<script lang="ts">
	import { enhance } from '$app/forms';
	import { CircleCheckIcon } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { AisleCoverageItem } from '$lib/server/aisle/coverage';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import AisleBulkBar from './AisleBulkBar.svelte';

	interface Props {
		items: AisleCoverageItem[];
		categories: string[];
		/** Where the assign actions send the browser back to. */
		returnTo?: string;
	}

	const { items, categories, returnTo = '/aisles/unassigned' }: Props = $props();

	const selected = new SvelteSet<string>();

	const allSelected = $derived(items.length > 0 && items.every((item) => selected.has(item.name)));

	function toggleAll() {
		if (allSelected) selected.clear();
		else for (const item of items) selected.add(item.name);
	}
</script>

<div class="flex h-full min-h-0 flex-col">
	<div class="border-border shrink-0 border-b px-4 py-3">
		<h2 class="text-fg text-sm font-semibold">Unassigned ingredients</h2>
		<p class="text-fg-muted mt-1 max-w-4xl text-sm">
			These appear in your recipes but not in any aisle, so they land under “Other” at the bottom of
			the shopping list. Tick several to file them all at once.
		</p>
	</div>

	{#if items.length === 0}
		<div class="min-h-0 flex-1 overflow-y-auto">
			<EmptyState
				icon={CircleCheckIcon}
				title="Every ingredient has an aisle"
				description="Nothing in your recipes falls through to “Other”."
			/>
		</div>
	{:else}
		<div class="border-border shrink-0 border-b px-4 py-2">
			<label class="text-fg-muted flex w-fit items-center gap-2 text-sm">
				<input
					type="checkbox"
					class="border-border text-accent focus:ring-accent size-4 rounded"
					checked={allSelected}
					onchange={toggleAll}
				/>
				Select all {items.length}
			</label>
		</div>

		<ul class="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
			{#each items as item (item.name)}
				<li class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
					<!-- The real bulk-form input, associated with the sticky bar's form
					     by id so it submits from out here in the row. -->
					<input
						type="checkbox"
						name="name"
						value={item.name}
						form="aisle-bulk-assign"
						checked={selected.has(item.name)}
						onchange={(event) =>
							event.currentTarget.checked ? selected.add(item.name) : selected.delete(item.name)}
						class="border-border text-accent focus:ring-accent size-4 shrink-0 rounded"
						aria-label="Select {item.name}"
					/>

					<div class="min-w-0 flex-1">
						<span class="text-fg font-medium capitalize">{item.name}</span>
						<span class="text-fg-subtle ml-2 text-xs tabular-nums">
							{item.recipeCount}
							{item.recipeCount === 1 ? 'recipe' : 'recipes'}
						</span>
						<div class="text-fg-muted truncate text-xs">
							{item.recipes.map((recipe) => recipe.title).join(', ')}
						</div>
					</div>

					{#if item.suggestedAliasOf}
						<!-- The far better fix for a plural. Adding "onions" as its own
						     entry works, but the file then grows a second line for every
						     spelling of everything. -->
						<form method="POST" action="?/assign" use:enhance class="shrink-0">
							<input type="hidden" name="name" value={item.name} />
							<input type="hidden" name="aliasOf" value={item.suggestedAliasOf} />
							<input type="hidden" name="category" value={categories[0] ?? ''} />
							<input type="hidden" name="returnTo" value={returnTo} />
							<Button type="submit" size="sm" variant="soft">
								Same as {item.suggestedAliasOf}
							</Button>
						</form>
					{/if}

					<form method="POST" action="?/assign" use:enhance class="flex shrink-0 gap-2">
						<input type="hidden" name="name" value={item.name} />
						<input type="hidden" name="returnTo" value={returnTo} />
						<!-- A native select: this is a real POST form and the Bits UI
						     select does not contribute a form value. -->
						<select
							name="category"
							class="field w-auto capitalize"
							aria-label="Aisle for {item.name}"
						>
							{#each categories as category (category)}
								<option value={category}>{category}</option>
							{/each}
						</select>
						<Button type="submit" size="sm" variant="outline" class="h-auto shrink-0">Assign</Button
						>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<AisleBulkBar
		formId="aisle-bulk-assign"
		action="?/bulkAssign"
		count={selected.size}
		onclear={() => selected.clear()}
		onsubmitted={() => selected.clear()}
	>
		{#snippet controls()}
			<input type="hidden" name="returnTo" value={returnTo} />
			<select name="category" class="field w-auto capitalize" aria-label="Assign selected to aisle">
				{#each categories as category (category)}
					<option value={category}>{category}</option>
				{/each}
			</select>
			<Button type="submit" size="sm" variant="primary">Assign</Button>
		{/snippet}
	</AisleBulkBar>
</div>
