<script lang="ts">
	import type { ImageRef } from '#lib/types/recipe.js';
	import InlineIngredient from '../inline/InlineIngredient.svelte';
	import InlineCookware from '../inline/InlineCookware.svelte';
	import InlineTimer from '../inline/InlineTimer.svelte';
	import StepImage from '../StepImage.svelte';
	import type { CookStep } from './cook-steps';

	/**
	 * One step's body. Shared by the live step and the swipe preview so the
	 * preview is a true picture of where the gesture will land, not a summary.
	 */
	interface Props {
		step: CookStep;
		stepImage?: ImageRef | null;
		hoveredIngredientIndex: number | null;
		hoveredCookwareIndex: number | null;
		activeIngredientIndices: Set<number> | null;
		activeCookwareIndices: Set<number> | null;
		activeTimerIndices: Set<number>;
		onhoverIngredient: (index: number | null) => void;
		onhoverCookware: (index: number | null) => void;
		onstartTimer: (index: number, name: string, quantity: string, stepNumber: number) => void;
	}

	const {
		step,
		stepImage = null,
		hoveredIngredientIndex,
		hoveredCookwareIndex,
		activeIngredientIndices,
		activeCookwareIndices,
		activeTimerIndices,
		onhoverIngredient,
		onhoverCookware,
		onstartTimer
	}: Props = $props();
</script>

<p class="text-fg text-lg leading-relaxed sm:text-xl">
	{#each step.step.items as item, itemIndex (itemIndex)}
		{#if item.type === 'text'}
			{item.value}
		{:else if item.type === 'ingredient'}
			<InlineIngredient
				name={item.name}
				quantity={item.quantity}
				index={item.index}
				highlighted={hoveredIngredientIndex === item.index}
				active={activeIngredientIndices?.has(item.index) ?? false}
				onhover={onhoverIngredient}
				large
			/>
		{:else if item.type === 'cookware'}
			<InlineCookware
				name={item.name}
				quantity={item.quantity}
				index={item.index}
				highlighted={hoveredCookwareIndex === item.index}
				active={activeCookwareIndices?.has(item.index) ?? false}
				onhover={onhoverCookware}
				large
			/>
		{:else if item.type === 'timer'}
			<InlineTimer
				name={item.name}
				quantity={item.quantity}
				index={item.index}
				cookMode
				active={activeTimerIndices.has(item.index)}
				onstart={(index, name, quantity) => onstartTimer(index, name, quantity, step.ordinal)}
				large
			/>
		{:else if item.type === 'inlineQuantity'}
			<span class="text-fg-subtle italic">
				{item.insideParentheses ? `${item.quantity})` : `(${item.quantity})`}
			</span>
		{/if}
	{/each}
</p>

{#if stepImage}
	<div class="mt-4 max-w-md">
		<StepImage image={stepImage} ordinal={step.ordinal} />
	</div>
{/if}
