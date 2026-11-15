<script lang="ts">
	import { CheckIcon, CircleIcon, ListOrderedIcon } from '@lucide/svelte';
	import { cookStepSummary, type CookStep } from './cook-steps';

	/**
	 * The step outline that shares the sidebar with the ingredients.
	 *
	 * Rows are buttons rather than links because navigation is URL-driven and
	 * uses `goto` with `replace`; that keeps back/forward and deep links
	 * working exactly as arrow-key navigation does.
	 */
	interface Props {
		steps: CookStep[];
		currentStep: number;
		ongoto: (ordinal: number) => void;
		/** The mobile tab strip already names the pane, so it can omit this. */
		header?: boolean;
	}

	const { steps, currentStep, ongoto, header = true }: Props = $props();
</script>

{#if header}
	<div class="border-border flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
		<h2 class="text-fg flex items-center gap-2 text-sm font-semibold">
			<ListOrderedIcon class="text-fg-subtle size-4" />
			Steps
		</h2>
		<span class="text-fg-subtle text-xs tabular-nums">{steps.length}</span>
	</div>
{/if}

<div class="pb-2">
	{#each steps as step, index (step.ordinal)}
		{#if index === 0 || steps[index - 1].sectionIndex !== step.sectionIndex}
			{#if step.sectionName}
				<p class="text-fg-subtle text-2xs px-4 pt-3 pb-1 font-semibold tracking-wide uppercase">
					{step.sectionName}
				</p>
			{/if}
		{/if}

		{@const isCompleted = step.ordinal < currentStep}
		{@const isCurrent = step.ordinal === currentStep}
		{@const label = cookStepSummary(step.step, 80) || `Step ${step.ordinal}`}

		<button
			type="button"
			aria-current={isCurrent ? 'step' : undefined}
			class="flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors duration-100 {isCurrent
				? 'border-accent2 bg-accent2-soft text-accent2-soft-fg font-medium'
				: isCompleted
					? 'text-fg-subtle hover:bg-surface-muted hover:text-fg-muted border-transparent'
					: 'text-fg-muted hover:bg-surface-muted hover:text-fg border-transparent'}"
			onclick={() => ongoto(step.ordinal)}
		>
			<span class="w-5 shrink-0 text-right text-xs tabular-nums">{step.ordinal}</span>

			{#if isCompleted}
				<CheckIcon class="text-ok size-3.5 shrink-0" aria-label="Completed" />
			{:else if isCurrent}
				<CircleIcon class="text-accent2 size-3.5 shrink-0 fill-current" aria-hidden="true" />
			{:else}
				<CircleIcon class="text-fg-subtle size-3.5 shrink-0" aria-hidden="true" />
			{/if}

			<span class="min-w-0 flex-1 truncate">{label}</span>
		</button>
	{/each}
</div>
