<script lang="ts">
	import { CarrotIcon } from '@lucide/svelte';
	import type { IngredientDisplay } from '$lib/types/recipe';
	import { highlightClass, resolveHighlight } from './highlight';

	interface Props {
		ingredients: IngredientDisplay[];
		hoveredIndex: number | null;
		activeIndices: Set<number> | null;
		onhover: (index: number | null) => void;
		/** When false, the tab strip already names the pane; omit its heading. */
		header?: boolean;
	}

	const { ingredients, hoveredIndex, activeIndices, onhover, header = true }: Props = $props();
</script>

{#snippet list()}
	<ul class="space-y-0.5 px-2 pb-2">
		{#each ingredients as ingredient (ingredient.index)}
			{@const state = resolveHighlight({
				hovered: hoveredIndex === ingredient.index,
				active: activeIndices?.has(ingredient.index) ?? false
			})}
			<!-- Hover cross-highlights the matching mention in the steps. It is a
				     pointer affordance only, so it carries no role or tabindex: the
				     ingredient text is already in the document for keyboard and
				     screen reader users. -->
			<li
				class="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 transition-colors duration-150 {highlightClass(
					state
				)}"
				onmouseenter={() => onhover(ingredient.index)}
				onmouseleave={() => onhover(null)}
			>
				<span class="min-w-0">
					<span class="font-medium">{ingredient.name}</span>
					{#if ingredient.note}
						<span class="text-fg-subtle text-sm italic"> ({ingredient.note})</span>
					{/if}
				</span>
				{#if ingredient.quantity}
					<span class="text-fg-muted shrink-0 text-right text-sm whitespace-nowrap tabular-nums">
						{ingredient.quantity}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#if ingredients.length > 0}
	{#if header}
		<section class="border-border border-b last:border-b-0">
			<h2 class="text-fg flex items-center gap-2 px-4 py-2 text-sm font-semibold">
				<CarrotIcon class="text-accent size-4 shrink-0" />
				Ingredients
				<span class="text-fg-subtle ml-auto text-xs font-normal tabular-nums">
					{ingredients.length}
				</span>
			</h2>
			{@render list()}
		</section>
	{:else}
		<div class="pt-1">
			{@render list()}
		</div>
	{/if}
{/if}
