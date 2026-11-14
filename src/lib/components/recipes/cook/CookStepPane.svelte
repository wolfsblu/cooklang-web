<script lang="ts">
	import { CheckCircle2Icon, ListOrderedIcon } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import type { ImageRef } from '$lib/types/recipe';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import CookStepBody from './CookStepBody.svelte';
	import type { CookStep } from './cook-steps';

	/**
	 * The "editor" pane of the cook workbench: one step at a time, set at
	 * cooking distance. The outline, timers and controls around it carry the
	 * navigation; nothing else is stacked into the reading area.
	 */
	interface Props {
		step: CookStep | null;
		previousStep: CookStep | null;
		nextStep: CookStep | null;
		totalSteps: number;
		/** Direction of the last change, so a swipe slides in the way it moved. */
		direction: 'next' | 'previous';
		stepImage?: ImageRef | null;
		stepImages?: Record<string, ImageRef | null>;
		hoveredIngredientIndex: number | null;
		hoveredCookwareIndex: number | null;
		activeIngredientIndices: Set<number> | null;
		activeCookwareIndices: Set<number> | null;
		activeTimerIndices: Set<number>;
		onhoverIngredient: (index: number | null) => void;
		onhoverCookware: (index: number | null) => void;
		onstartTimer: (index: number, name: string, quantity: string, stepNumber: number) => void;
		ongoto: (step: number) => void;
		onprevious: () => void;
		onnext: () => void;
		onexit: () => void;
	}

	const {
		step,
		previousStep,
		nextStep,
		totalSteps,
		direction,
		stepImage = null,
		stepImages = {},
		hoveredIngredientIndex,
		hoveredCookwareIndex,
		activeIngredientIndices,
		activeCookwareIndices,
		activeTimerIndices,
		onhoverIngredient,
		onhoverCookware,
		onstartTimer,
		ongoto,
		onprevious,
		onnext,
		onexit
	}: Props = $props();

	const noTimers = new Set<number>();

	let scrollContainer = $state<HTMLDivElement | null>(null);
	let reducedMotion = $state(false);

	$effect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = media.matches;

		const update = (event: MediaQueryListEvent) => (reducedMotion = event.matches);
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	// Each step starts at its own top, rather than inheriting the previous
	// step's scroll offset when the pane content is swapped.
	$effect(() => {
		if (!scrollContainer) return;

		const ordinal = step?.ordinal;
		if (ordinal !== undefined) scrollContainer.scrollTop = 0;
	});

	// Live drag: the step follows the finger, and only a release past the
	// visible threshold commits the move. A vertical drag belongs to the pane's
	// scroll, so it is left entirely alone.
	const SWIPE_THRESHOLD = 96;

	let dragX = $state(0);
	let dragging = $state(false);
	let transitioning = $state(false);
	let committing = $state(false);
	let skipIncoming = $state(false);
	let touchStart: { x: number; y: number; id: number } | null = null;
	let axis: 'horizontal' | 'vertical' | null = null;
	let commitTimer: ReturnType<typeof setTimeout> | undefined;

	const canGoNext = $derived(step !== null && step.ordinal < totalSteps);
	const canGoPrevious = $derived(step !== null && step.ordinal > 1);
	const dragDirection = $derived(dragX < 0 ? 'next' : 'previous');
	const dragProgress = $derived(Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD));
	const canCommitDrag = $derived(dragDirection === 'next' ? canGoNext : canGoPrevious);

	const previewStep = $derived(dragDirection === 'next' ? nextStep : previousStep);
	const previewImage = $derived(previewStep ? (stepImages[previewStep.ordinal] ?? null) : null);
	const previewVisible = $derived(
		(dragging || committing) && canCommitDrag && previewStep !== null
	);
	const previewOffset = $derived((1 - dragProgress) * 32);
	// Keep the neighbouring step visibly a preview while dragging, then bring it
	// to full strength as the release commits and the live step slides away.
	const previewOpacity = $derived(dragProgress * (committing ? 1 : 0.6));
	const showRelease = $derived(dragging && dragProgress >= 1);

	function isMobileViewport() {
		return window.matchMedia('(max-width: 1023px)').matches;
	}

	function handleTouchStart(event: TouchEvent) {
		touchStart = null;
		axis = null;
		dragging = false;

		if (committing || !isMobileViewport() || event.touches.length !== 1) return;

		const target = event.target instanceof Element ? event.target : null;
		if (
			target?.closest(
				'button, a, input, textarea, select, [role="button"], [role="tab"], [contenteditable="true"]'
			)
		) {
			return;
		}

		const touch = event.touches[0];
		touchStart = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
		transitioning = false;
		dragX = 0;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!touchStart) return;

		const touch = Array.from(event.touches).find((item) => item.identifier === touchStart?.id);
		if (!touch) return;

		const dx = touch.clientX - touchStart.x;
		const dy = touch.clientY - touchStart.y;

		if (!axis) {
			if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

			if (Math.abs(dx) > Math.abs(dy) * 0.8) {
				axis = 'horizontal';
				dragging = true;
			} else {
				axis = 'vertical';
				return;
			}
		}

		if (axis !== 'horizontal') return;
		event.preventDefault();

		const limit = (scrollContainer?.clientWidth ?? window.innerWidth) * 0.6;
		dragX = Math.max(-limit, Math.min(limit, dx));
	}

	function handleTouchEnd() {
		if (!touchStart) return;

		const wasDragging = dragging;
		const dx = dragX;
		const dragTo = dx < 0 ? 'next' : 'previous';
		const canCommit = dragTo === 'next' ? canGoNext : canGoPrevious;

		touchStart = null;
		axis = null;
		dragging = false;

		if (!wasDragging) return;

		if (Math.abs(dx) >= SWIPE_THRESHOLD && canCommit) {
			commitDrag(dragTo);
			return;
		}

		transitioning = !reducedMotion;
		dragX = 0;
	}

	function handleTouchCancel() {
		touchStart = null;
		axis = null;
		dragging = false;
		transitioning = !reducedMotion;
		dragX = 0;
	}

	function commitDrag(dragTo: 'next' | 'previous') {
		if (reducedMotion) {
			dragX = 0;
			committing = false;

			if (dragTo === 'next') onnext();
			else onprevious();
			return;
		}

		const width = scrollContainer?.clientWidth ?? window.innerWidth;

		committing = true;
		skipIncoming = true;
		transitioning = true;
		dragX = dragTo === 'next' ? -width : width;

		clearTimeout(commitTimer);
		commitTimer = setTimeout(() => {
			// Keep the outgoing content off-screen until the new step arrives.
			// The preview behind it is already showing that step, so the swap
			// is invisible.
			if (dragTo === 'next') onnext();
			else onprevious();
		}, 160);
	}

	// A step change ends any gesture: the preview has already shown the new
	// step, so reveal the real content in place without a second slide. This
	// also cancels a pending commit if another navigation wins the race.
	$effect(() => {
		const ordinal = step?.ordinal;
		if (ordinal === undefined) return;

		clearTimeout(commitTimer);
		committing = false;
		transitioning = false;
		dragX = 0;
		skipIncoming = false;
	});

	$effect(() => () => clearTimeout(commitTimer));
</script>

<div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
	<!-- The tab strip names the open step, the way the editor's preview tab does. -->
	<div
		class="border-border bg-surface-muted/30 hidden shrink-0 items-center border-b px-3 py-1.5 sm:px-4 lg:flex"
	>
		<h2
			class="border-accent text-fg flex min-w-0 items-center gap-1.5 border-b-2 py-1"
			aria-live="polite"
		>
			<ListOrderedIcon class="text-accent size-3.5 shrink-0" />
			<span class="shrink-0 text-xs font-medium tabular-nums">
				{step ? `Step ${step.ordinal} of ${totalSteps}` : 'Recipe'}
			</span>

			{#if step?.sectionName}
				<span class="text-fg-subtle shrink-0 text-xs">/ {step.sectionName}</span>
			{/if}
		</h2>
	</div>

	<div class="relative min-h-0 flex-1">
		{#if previewVisible && previewStep}
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-4 py-5 sm:px-6 sm:py-6"
				style:transform="translateX({dragDirection === 'next' ? previewOffset : -previewOffset}px)"
				aria-hidden="true"
				inert
			>
				<div
					class="w-full max-w-[68ch] {committing ? 'transition-opacity duration-150' : ''}"
					style:opacity={previewOpacity}
				>
					<CookStepBody
						step={previewStep}
						stepImage={previewImage}
						hoveredIngredientIndex={null}
						hoveredCookwareIndex={null}
						activeIngredientIndices={null}
						activeCookwareIndices={null}
						activeTimerIndices={noTimers}
						onhoverIngredient={() => {}}
						onhoverCookware={() => {}}
						onstartTimer={() => {}}
					/>
				</div>

				{#if showRelease}
					<span
						class="bg-accent text-accent-fg shadow-pop absolute top-4 rounded-full px-3 py-1 text-xs font-medium {dragDirection ===
						'next'
							? 'right-4'
							: 'left-4'}"
					>
						Release
					</span>
				{/if}
			</div>
		{/if}

		<div
			bind:this={scrollContainer}
			class="relative z-10 h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain"
			style:touch-action="pan-y pinch-zoom"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
			ontouchcancel={handleTouchCancel}
		>
			<div
				class="bg-surface flex min-h-full flex-col will-change-transform {transitioning
					? 'transition-transform duration-150 ease-out'
					: ''}"
				style:transform="translateX({dragX}px)"
			>
				{#key step?.ordinal ?? 'empty'}
					<div
						class="flex flex-1 items-center justify-center px-4 py-5 sm:px-6 sm:py-6"
						in:fly={{
							x: skipIncoming ? 0 : direction === 'next' ? 40 : -40,
							duration: skipIncoming || reducedMotion ? 0 : 180
						}}
					>
						{#if step}
							<div class="w-full max-w-[68ch]">
								<CookStepBody
									{step}
									{stepImage}
									{hoveredIngredientIndex}
									{hoveredCookwareIndex}
									{activeIngredientIndices}
									{activeCookwareIndices}
									{activeTimerIndices}
									{onhoverIngredient}
									{onhoverCookware}
									{onstartTimer}
								/>
							</div>
						{:else if totalSteps === 0}
							<div class="w-full">
								<EmptyState
									icon={ListOrderedIcon}
									title="This recipe has no steps"
									description="There is nothing to cook through yet. Add steps in the editor, then come back."
								>
									{#snippet actions()}
										<Button variant="outline" onclick={onexit}>Exit cook mode</Button>
									{/snippet}
								</EmptyState>
							</div>
						{:else}
							<div class="w-full">
								<EmptyState
									icon={CheckCircle2Icon}
									title="Recipe complete"
									description="You made it through all {totalSteps} steps. Turn off the hob and serve."
								>
									{#snippet actions()}
										<Button variant="outline" onclick={() => ongoto(totalSteps)}>
											Back to last step
										</Button>
										<Button onclick={onexit}>Exit cook mode</Button>
									{/snippet}
								</EmptyState>
							</div>
						{/if}
					</div>
				{/key}
			</div>
		</div>
	</div>
</div>
