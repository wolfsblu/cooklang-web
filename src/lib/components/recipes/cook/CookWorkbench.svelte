<script lang="ts">
	import {
		ArrowLeftIcon,
		CarrotIcon,
		ChevronDownIcon,
		ChevronUpIcon,
		CookingPotIcon,
		ListOrderedIcon,
		TimerIcon,
		Volume2Icon,
		VolumeXIcon,
		XIcon
	} from '@lucide/svelte';
	import type { ActiveTimer, ImageRef, RecipeDisplay } from '$lib/types/recipe';
	import { countLabel } from '$lib/utils/pluralize';
	import { formatScale } from '$lib/utils/scale';
	import Badge from '$lib/components/ui/Badge.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import Page from '$lib/components/ui/Page.svelte';
	import RecipeIngredients from '../RecipeIngredients.svelte';
	import RecipeCookware from '../RecipeCookware.svelte';
	import ServingsControl from '../ServingsControl.svelte';
	import CookControlBar from './CookControlBar.svelte';
	import CookStepOutline from './CookStepOutline.svelte';
	import CookStepPane from './CookStepPane.svelte';
	import CookTimersPanel from './CookTimersPanel.svelte';
	import { flattenCookSteps } from './cook-steps';

	/**
	 * Cook mode as a workbench, matching the recipe detail, pantry, shopping and
	 * editor pages: one frame with a title bar, a split outline/step area, a
	 * docked timers panel and a status bar. The page itself never scrolls; each
	 * pane owns its own overflow.
	 */
	interface Props {
		recipe: RecipeDisplay;
		slug: string;
		relPath?: string;
		scale: number;
		baseServings: number | null;
		stepImages?: Record<string, ImageRef | null>;
		currentStep: number;
		/** Direction of the last step change, for the mobile swipe animation. */
		direction: 'next' | 'previous';
		timeSummary: string | null;
		servingsSummary: string | null;
		hoveredIngredientIndex: number | null;
		hoveredCookwareIndex: number | null;
		activeIngredientIndices: Set<number> | null;
		activeCookwareIndices: Set<number> | null;
		activeTimerIndices: Set<number>;
		timers: ActiveTimer[];
		audioEnabled: boolean;
		timersPanelOpen: boolean;
		timersExpanded: boolean;
		onhoverIngredient: (index: number | null) => void;
		onhoverCookware: (index: number | null) => void;
		onstartTimer: (index: number, name: string, quantity: string, stepNumber: number) => void;
		onscale: (scale: number) => void;
		onprevious: () => void;
		onnext: () => void;
		ongoto: (step: number) => void;
		onexit: () => void;
		ontoggletimers: () => void;
		ontoggleaudio: () => void;
		ontoggleexpanded: () => void;
		onaddtimer: (name: string, totalSeconds: number) => void;
		onpause: (id: string) => void;
		onresume: (id: string) => void;
		oncancel: (id: string) => void;
	}

	const {
		recipe,
		slug,
		relPath = '',
		scale,
		baseServings,
		stepImages = {},
		currentStep,
		direction,
		timeSummary,
		servingsSummary,
		hoveredIngredientIndex,
		hoveredCookwareIndex,
		activeIngredientIndices,
		activeCookwareIndices,
		activeTimerIndices,
		timers,
		audioEnabled,
		timersPanelOpen,
		timersExpanded,
		onhoverIngredient,
		onhoverCookware,
		onstartTimer,
		onscale,
		onprevious,
		onnext,
		ongoto,
		onexit,
		ontoggletimers,
		ontoggleaudio,
		ontoggleexpanded,
		onaddtimer,
		onpause,
		onresume,
		oncancel
	}: Props = $props();

	const title = $derived(recipe.title ?? 'Untitled Recipe');
	const steps = $derived(flattenCookSteps(recipe.sections));
	const totalSteps = $derived(steps.length);
	const current = $derived(steps[currentStep - 1] ?? null);
	const previousStep = $derived(current && current.ordinal > 1 ? steps[current.ordinal - 2] : null);
	const nextStep = $derived(
		current && current.ordinal < totalSteps ? steps[current.ordinal] : null
	);
	const currentImage = $derived(current ? (stepImages[current.ordinal] ?? null) : null);
	const visibleStep = $derived(
		totalSteps === 0 ? 0 : Math.min(Math.max(currentStep, 1), totalSteps)
	);
	const stepCounter = $derived(
		totalSteps === 0 ? 'No steps' : `Step ${visibleStep} of ${totalSteps}`
	);
	const recipeHref = $derived(
		scale === 1
			? `/recipe/${slug}`
			: `/recipe/${slug}?scale=${encodeURIComponent(formatScale(scale))}`
	);
	const timersLabel = $derived(
		!timersPanelOpen
			? 'Show timers'
			: `${timersExpanded ? 'Collapse' : 'Expand'} timers${
					timers.length > 0 ? `, ${countLabel(timers.length, 'active timer')}` : ''
				}`
	);

	type PaneTab = 'steps' | 'ingredients' | 'cookware';

	// Below `lg` the sidebar is a collapsible strip so the current step is
	// visible immediately. From `lg` up every pane stacks in a permanent column.
	let paneTab = $state<PaneTab>('steps');
	let paneOpen = $state(false);

	const tabs = $derived([
		{ id: 'steps' as const, label: 'Steps', icon: ListOrderedIcon, count: steps.length },
		...(recipe.ingredients.length > 0
			? [
					{
						id: 'ingredients' as const,
						label: 'Ingredients',
						icon: CarrotIcon,
						count: recipe.ingredients.length
					}
				]
			: []),
		...(recipe.cookware.length > 0
			? [
					{
						id: 'cookware' as const,
						label: 'Cookware',
						icon: CookingPotIcon,
						count: recipe.cookware.length
					}
				]
			: [])
	]);

	$effect(() => {
		if (!tabs.some((tab) => tab.id === paneTab)) paneTab = 'steps';
	});

	/** A tab opens its pane; tapping the active tab again closes the strip. */
	function selectPaneTab(tab: PaneTab) {
		if (paneTab === tab && paneOpen) {
			paneOpen = false;
			return;
		}

		paneTab = tab;
		paneOpen = true;
	}

	function onTabKeydown(event: KeyboardEvent, index: number) {
		if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();

		let next = index;
		if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === 'Home') next = 0;
		else next = tabs.length - 1;

		paneTab = tabs[next].id;
		paneOpen = true;

		const buttons = (
			event.currentTarget as HTMLElement
		).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
		buttons?.[next]?.focus();
	}

	/** Picking a step should reveal it, not leave the strip covering it. */
	function goToStep(ordinal: number) {
		paneOpen = false;
		ongoto(ordinal);
	}
</script>

<Page full flush class="flex h-full min-h-0 flex-col">
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none border border-t-0 md:border-l-0"
	>
		<header
			class="border-border bg-surface flex shrink-0 flex-wrap items-center border-b md:gap-x-3 md:px-4 md:py-2"
		>
			<div class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 md:px-0 md:py-0">
				<a
					href={recipeHref}
					class="text-fg-muted hover:text-fg inline-flex shrink-0 items-center gap-1 text-sm font-medium transition-colors duration-150"
				>
					<ArrowLeftIcon class="size-4" />
					<span class="hidden sm:inline">Recipe</span>
					<span class="sr-only sm:hidden">Back to recipe</span>
				</a>

				<span class="bg-border hidden h-5 w-px sm:block" aria-hidden="true"></span>

				<div class="min-w-0 flex-1">
					<div class="flex min-w-0 items-center gap-2">
						<h1 class="text-fg truncate text-base font-semibold" {title}>{title}</h1>
						<Badge tone="accent" class="shrink-0">Cooking</Badge>
					</div>
					{#if relPath}
						<p class="text-fg-subtle truncate text-xs" title={relPath}>{relPath}</p>
					{/if}
				</div>
			</div>

			<!--
				Phones and tablets get an action strip of their own, as on the recipe
				detail and pantry pages, so the title is never squeezed to nothing.
			-->
			<div
				class="border-border bg-surface-muted/30 flex w-full min-w-0 flex-wrap items-center justify-end gap-0.5 border-t px-3 py-1.5 md:ml-auto md:w-auto md:shrink-0 md:flex-nowrap md:border-t-0 md:bg-transparent md:px-0 md:py-0"
			>
				<h2
					class="border-accent text-fg mr-auto flex items-center gap-1.5 border-b-2 py-1 lg:hidden"
				>
					<ListOrderedIcon class="text-accent size-3.5 shrink-0" />
					<span class="text-xs font-medium tabular-nums" aria-live="polite">{stepCounter}</span>
				</h2>

				<span class="relative inline-flex">
					<IconButton
						label={timersLabel}
						variant={timersPanelOpen ? 'soft' : 'ghost'}
						onclick={ontoggletimers}
					>
						<TimerIcon class="size-4" />
					</IconButton>
					{#if timers.length > 0}
						<span
							class="bg-warn text-warn-fg text-2xs pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full font-semibold"
							aria-hidden="true"
						>
							{timers.length}
						</span>
					{/if}
				</span>

				<IconButton
					label={audioEnabled ? 'Mute timer alerts' : 'Unmute timer alerts'}
					onclick={ontoggleaudio}
				>
					{#if audioEnabled}
						<Volume2Icon class="size-4" />
					{:else}
						<VolumeXIcon class="size-4" />
					{/if}
				</IconButton>

				<span class="bg-border mx-1 h-5 w-px" aria-hidden="true"></span>

				<IconButton label="Exit cook mode" onclick={onexit}>
					<XIcon class="size-4" />
				</IconButton>
			</div>
		</header>

		<div
			class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[21rem_minmax(0,1fr)] lg:grid-rows-1"
		>
			<aside
				class="border-border bg-surface-muted/40 order-1 min-h-0 min-w-0 overflow-hidden border-b lg:border-r lg:border-b-0"
				aria-label="Recipe outline"
			>
				<div class="flex h-full min-h-0 flex-col">
					<!-- Mobile tab strip: roving tabindex, same pattern as the recipe detail. -->
					<div
						class="border-border bg-surface-muted/40 hover:bg-surface-muted/70 relative flex shrink-0 items-center gap-1 px-1 transition-colors duration-100 lg:hidden"
					>
						<button
							type="button"
							tabindex="-1"
							aria-hidden="true"
							class="absolute inset-0 z-0 cursor-pointer"
							onclick={() => (paneOpen = !paneOpen)}
						></button>

						<div
							class="no-scrollbar relative z-10 flex min-w-0 items-center gap-0.5 overflow-x-auto"
							role="tablist"
							aria-label="Cook mode panes"
						>
							{#each tabs as tab, index (tab.id)}
								<button
									type="button"
									role="tab"
									id="cook-tab-{tab.id}"
									aria-selected={paneTab === tab.id}
									aria-controls="cook-outline-panel"
									tabindex={paneTab === tab.id ? 0 : -1}
									class="flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium transition-colors duration-100 {paneTab ===
									tab.id
										? 'text-fg'
										: 'text-fg-muted hover:text-fg'} {paneTab === tab.id && paneOpen
										? 'border-accent'
										: 'border-transparent'}"
									onclick={() => selectPaneTab(tab.id)}
									onkeydown={(event) => onTabKeydown(event, index)}
								>
									<tab.icon class="size-3.5" />
									{tab.label}
									<span class="text-fg-subtle tabular-nums">{tab.count}</span>
								</button>
							{/each}
						</div>

						<button
							type="button"
							class="text-fg-subtle hover:text-fg relative z-10 ml-auto shrink-0 rounded p-1.5 transition-colors duration-100"
							aria-expanded={paneOpen}
							aria-controls="cook-outline-panel"
							aria-label={paneOpen ? 'Collapse recipe panes' : 'Expand recipe panes'}
							onclick={() => (paneOpen = !paneOpen)}
						>
							{#if paneOpen}
								<ChevronDownIcon class="size-3.5" aria-hidden="true" />
							{:else}
								<ChevronUpIcon class="size-3.5" aria-hidden="true" />
							{/if}
						</button>
					</div>

					<div
						id="cook-outline-panel"
						class="border-border max-h-64 min-h-0 overflow-y-auto overscroll-y-contain border-t lg:hidden {paneOpen
							? 'block'
							: 'hidden'}"
						role="tabpanel"
						aria-labelledby="cook-tab-{paneTab}"
					>
						{#if paneTab === 'steps'}
							<CookStepOutline {steps} {currentStep} ongoto={goToStep} header={false} />
						{:else if paneTab === 'ingredients'}
							<div class="border-border border-b px-4 py-1">
								<dl>
									<ServingsControl {baseServings} {scale} {onscale} />
								</dl>
							</div>
							<RecipeIngredients
								ingredients={recipe.ingredients}
								hoveredIndex={hoveredIngredientIndex}
								activeIndices={activeIngredientIndices}
								onhover={onhoverIngredient}
								header={false}
							/>
						{:else}
							<RecipeCookware
								cookware={recipe.cookware}
								hoveredIndex={hoveredCookwareIndex}
								activeIndices={activeCookwareIndices}
								onhover={onhoverCookware}
								header={false}
							/>
						{/if}
					</div>

					<!-- Desktop: all panes stacked in one scrolling column. -->
					<div class="hidden min-h-0 flex-1 overflow-y-auto overscroll-y-contain lg:block">
						<CookStepOutline {steps} {currentStep} ongoto={goToStep} />

						<div class="border-border border-b px-4 py-1">
							<dl>
								<ServingsControl {baseServings} {scale} {onscale} />
							</dl>
						</div>

						<RecipeIngredients
							ingredients={recipe.ingredients}
							hoveredIndex={hoveredIngredientIndex}
							activeIndices={activeIngredientIndices}
							onhover={onhoverIngredient}
						/>

						<RecipeCookware
							cookware={recipe.cookware}
							hoveredIndex={hoveredCookwareIndex}
							activeIndices={activeCookwareIndices}
							onhover={onhoverCookware}
						/>
					</div>
				</div>
			</aside>

			<main class="order-2 flex min-h-0 min-w-0 flex-col" aria-label="Current step">
				<CookStepPane
					step={current}
					{previousStep}
					{nextStep}
					{totalSteps}
					{direction}
					stepImage={currentImage}
					{stepImages}
					{hoveredIngredientIndex}
					{hoveredCookwareIndex}
					{activeIngredientIndices}
					{activeCookwareIndices}
					{activeTimerIndices}
					{onhoverIngredient}
					{onhoverCookware}
					{onstartTimer}
					ongoto={goToStep}
					{onprevious}
					{onnext}
					{onexit}
				/>
			</main>
		</div>

		{#if timersPanelOpen}
			<CookTimersPanel
				{timers}
				{audioEnabled}
				expanded={timersExpanded}
				{ontoggleexpanded}
				{ontoggleaudio}
				{onaddtimer}
				{onpause}
				{onresume}
				{oncancel}
			/>
		{/if}

		<CookControlBar {currentStep} {totalSteps} {onprevious} {onnext} {onexit} />

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-1.5 text-xs"
			style="padding-bottom: calc(env(safe-area-inset-bottom) + 0.375rem)"
		>
			<span class="tabular-nums">{stepCounter}</span>
			<span class="text-border" aria-hidden="true">·</span>

			{#if timeSummary}
				<span class="tabular-nums">{timeSummary}</span>
				<span class="text-border" aria-hidden="true">·</span>
			{/if}

			{#if servingsSummary}
				<span class="tabular-nums">{servingsSummary}</span>
				<span class="text-border" aria-hidden="true">·</span>
			{/if}

			{#if scale !== 1}
				<span class="tabular-nums">{formatScale(scale)}× scale</span>
				<span class="text-border" aria-hidden="true">·</span>
			{/if}

			<span class="tabular-nums">{countLabel(timers.length, 'timer')}</span>

			<span class="ml-auto flex shrink-0 items-center gap-1.5">
				<span class="sm:hidden">Swipe to navigate</span>
				<span class="hidden sm:inline">Navigate</span>
				<kbd
					class="border-border bg-surface-muted text-2xs hidden rounded border px-1.5 py-0.5 font-sans sm:inline"
					>←</kbd
				>
				<kbd
					class="border-border bg-surface-muted text-2xs hidden rounded border px-1.5 py-0.5 font-sans sm:inline"
					>→</kbd
				>
			</span>
		</footer>
	</div>
</Page>
