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
				<li class="px-4 py-3">
					<div class="flex items-start gap-3">
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
							class="border-border text-accent focus:ring-accent mt-0.5 size-4 shrink-0 rounded"
							aria-label="Select {item.name}"
						/>

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-baseline gap-x-2">
								<span class="text-fg font-medium break-words capitalize">{item.name}</span>
								<span class="text-fg-subtle text-xs tabular-nums">
									{item.recipeCount}
									{item.recipeCount === 1 ? 'recipe' : 'recipes'}
								</span>
							</div>
							<div class="text-fg-muted line-clamp-2 text-xs sm:line-clamp-none sm:truncate">
								{item.recipes.map((recipe) => recipe.title).join(', ')}
							</div>
						</div>
					</div>

					<div class="mt-2 flex flex-col gap-2 pl-7 sm:flex-row sm:flex-wrap sm:items-center">
						{#if item.suggestedAliasOf}
							<!-- The far better fix for a plural. Adding "onions" as its own
							     entry works, but the file then grows a second line for every
							     spelling of everything. -->
							<form method="POST" action="?/assign" use:enhance class="sm:shrink-0">
								<input type="hidden" name="name" value={item.name} />
								<input type="hidden" name="aliasOf" value={item.suggestedAliasOf} />
								<input type="hidden" name="category" value={categories[0] ?? ''} />
								<input type="hidden" name="returnTo" value={returnTo} />
								<Button type="submit" size="sm" variant="soft" class="w-full sm:w-auto">
									Same as {item.suggestedAliasOf}
								</Button>
							</form>
						{/if}

						<form
							method="POST"
							action="?/assign"
							use:enhance
							class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
						>
							<input type="hidden" name="name" value={item.name} />
							<input type="hidden" name="returnTo" value={returnTo} />
							<!-- A native select: this is a real POST form and the Bits UI
							     select does not contribute a form value. -->
							<select
								name="category"
								class="field w-full min-w-0 capitalize sm:w-auto"
								aria-label="Aisle for {item.name}"
							>
								{#each categories as category (category)}
									<option value={category}>{category}</option>
								{/each}
							</select>
							<Button
								type="submit"
								size="sm"
								variant="outline"
								class="h-auto w-full shrink-0 sm:w-auto">Assign</Button
							>
						</form>
					</div>
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
