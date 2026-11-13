<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChevronDownIcon, ChevronUpIcon, MinusIcon, PlusIcon, Trash2Icon } from '@lucide/svelte';
	import type { RecipeSelection } from '$lib/types/shopping-list';
	import { formatScale, stepScaleDown, stepScaleUp } from '$lib/utils/scale';
	import { countLabel } from '$lib/utils/pluralize';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';

	interface Props {
		selections: RecipeSelection[];
		/** Mobile only: whether the bottom sheet is expanded. */
		open?: boolean;
		ontoggle?: () => void;
	}

	const { selections, open = true, ontoggle }: Props = $props();

	let confirmingClear = $state(false);
	let clearForm = $state<HTMLFormElement | null>(null);
</script>

<section class="flex h-full min-h-0 flex-col">
	<div
		class="border-border flex h-10 shrink-0 items-stretch justify-between gap-0 border-b px-0 lg:h-auto lg:items-center lg:gap-2 lg:px-4 lg:py-2"
	>
		<h2 class="text-fg flex min-w-0 flex-1 text-sm font-semibold">
			<!-- On phones the title is the drawer handle; from lg the pane is a
			     permanent sidebar, so the plain heading is enough. -->
			<button
				type="button"
				class="hover:bg-surface-muted flex w-full items-center gap-2 px-4 py-2 text-left transition-colors lg:hidden"
				aria-expanded={open}
				aria-controls="shopping-recipes-list"
				aria-label={open
					? `Hide recipes (${selections.length})`
					: `Show recipes (${selections.length})`}
				onclick={() => ontoggle?.()}
			>
				{#if open}
					<ChevronDownIcon class="text-fg-subtle size-4 shrink-0" aria-hidden="true" />
				{:else}
					<ChevronUpIcon class="text-fg-subtle size-4 shrink-0" aria-hidden="true" />
				{/if}
				<span class="truncate">Recipes ({selections.length})</span>
			</button>
			<span class="hidden lg:block">Recipes ({selections.length})</span>
		</h2>

		{#if selections.length > 0}
			<form
				method="POST"
				action="?/clear"
				use:enhance
				bind:this={clearForm}
				class="flex shrink-0 self-stretch lg:self-center"
			>
				<button
					type="button"
					class="text-danger-soft-fg bg-danger-soft hover:bg-danger-soft/70 flex h-full w-10 items-center justify-center transition-colors duration-150 lg:hidden"
					aria-label="Clear all"
					title="Clear all"
					onclick={() => (confirmingClear = true)}
				>
					<Trash2Icon class="size-4" />
				</button>
				<Button
					type="button"
					variant="dangerSoft"
					size="sm"
					class="hidden lg:inline-flex"
					onclick={() => (confirmingClear = true)}
				>
					<Trash2Icon class="size-4" />
					Clear all
				</Button>
			</form>
		{/if}
	</div>

	<ul
		id="shopping-recipes-list"
		class="divide-border min-h-0 flex-1 divide-y overflow-y-auto px-4 pb-4 {open
			? 'block'
			: 'hidden'} lg:block"
	>
		{#each selections as selection (selection.slug)}
			<li class="space-y-1.5 py-2 first:pt-0">
				<!-- A line of its own, so the title is not truncated to whatever the
				     stepper and the remove button leave over. -->
				<a href="/recipe/{selection.slug}" class="link block text-sm font-medium">
					{selection.title}
				</a>

				<div class="flex items-center gap-2">
					{#if selection.servings}
						<span class="text-fg-muted text-xs">
							{countLabel(Math.round(selection.servings * selection.scale), 'serving')}
						</span>
					{/if}

					<!-- `ml-auto` rather than `justify-between`: the controls stay right
					     regardless of whether the recipe declares any servings. -->
					<div class="ml-auto flex shrink-0 items-center gap-2">
						<div class="border-border flex items-center gap-1 rounded-md border px-1 py-0.5">
							<form method="POST" action="?/setScale" use:enhance>
								<input type="hidden" name="slug" value={selection.slug} />
								<input type="hidden" name="scale" value={stepScaleDown(selection.scale)} />
								<IconButton
									type="submit"
									size="sm"
									label="Decrease {selection.title}"
									disabled={selection.scale <= 0.5}
								>
									<MinusIcon class="size-3.5" />
								</IconButton>
							</form>

							<span class="min-w-10 text-center text-sm tabular-nums">
								{formatScale(selection.scale)}×
							</span>

							<form method="POST" action="?/setScale" use:enhance>
								<input type="hidden" name="slug" value={selection.slug} />
								<input type="hidden" name="scale" value={stepScaleUp(selection.scale)} />
								<IconButton type="submit" size="sm" label="Increase {selection.title}">
									<PlusIcon class="size-3.5" />
								</IconButton>
							</form>
						</div>

						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="slug" value={selection.slug} />
							<IconButton type="submit" variant="dangerSoft" label="Remove {selection.title}">
								<Trash2Icon class="size-4" />
							</IconButton>
						</form>
					</div>
				</div>
			</li>
		{/each}
	</ul>
</section>

<ConfirmDialog
	bind:open={confirmingClear}
	title="Clear shopping list?"
	description="Every recipe will be removed from the list. This cannot be undone."
	confirmLabel="Clear all"
	destructive
	onconfirm={() => clearForm?.requestSubmit()}
/>
