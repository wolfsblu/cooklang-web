<script lang="ts">
	import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';

	/**
	 * The workbench control row, inside the frame above the status bar.
	 *
	 * This used to be a fixed bar hovering over the document. It now sits in
	 * normal flow, so it never covers the step and cannot overlap the timers
	 * panel. Buttons keep a 44px touch target for use with messy hands.
	 */
	interface Props {
		currentStep: number;
		totalSteps: number;
		onprevious: () => void;
		onnext: () => void;
		onexit: () => void;
	}

	const { currentStep, totalSteps, onprevious, onnext, onexit }: Props = $props();

	const max = $derived(Math.max(totalSteps, 1));
	const clampedStep = $derived(Math.min(Math.max(currentStep, 1), max));
	const isFirstStep = $derived(currentStep <= 1);
	const isLastStep = $derived(totalSteps === 0 || currentStep >= totalSteps);
	const progressPercent = $derived((clampedStep / max) * 100);
</script>

<div class="border-border flex shrink-0 items-center gap-2 border-t px-3 py-2 sm:gap-3 sm:px-4">
	<Button
		variant="ghost"
		class="min-h-11 shrink-0"
		onclick={onprevious}
		disabled={isFirstStep}
		aria-label="Previous step"
	>
		<ChevronLeftIcon class="size-5" />
		<span class="hidden sm:inline">Previous</span>
	</Button>

	<div
		class="bg-surface-sunk h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
		role="progressbar"
		aria-label="Cooking progress"
		aria-valuenow={clampedStep}
		aria-valuemin={1}
		aria-valuemax={max}
	>
		<div
			class="bg-accent h-full rounded-full transition-[width] duration-300"
			style="width: {progressPercent}%"
		></div>
	</div>

	{#if isLastStep}
		<Button class="min-h-11 shrink-0" onclick={onexit} aria-label="Finish cooking">
			<CheckIcon class="size-5" />
			<span class="hidden sm:inline">Finish</span>
		</Button>
	{:else}
		<Button class="min-h-11 shrink-0" onclick={onnext} aria-label="Next step">
			<span class="hidden sm:inline">Next</span>
			<ChevronRightIcon class="size-5" />
		</Button>
	{/if}
</div>
