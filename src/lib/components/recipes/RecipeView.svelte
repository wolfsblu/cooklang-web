<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		ArrowLeftIcon,
		CarrotIcon,
		ChevronDownIcon,
		ChevronUpIcon,
		CookingPotIcon,
		InfoIcon,
		ListOrderedIcon
	} from '@lucide/svelte';
	import type { ImageRef, RecipeDisplay, StepDisplay, ActiveTimer } from '$lib/types/recipe';
	import { parseTimerQuantity } from '$lib/utils/timer';
	import { formatScale } from '$lib/utils/scale';
	import { playAlertSound } from '$lib/utils/audio';
	import Page from '$lib/components/ui/Page.svelte';
	import RecipeHeader from './RecipeHeader.svelte';
	import RecipeMeta from './RecipeMeta.svelte';
	import RecipeIngredients from './RecipeIngredients.svelte';
	import RecipeCookware from './RecipeCookware.svelte';
	import RecipeSteps from './RecipeSteps.svelte';
	import RecipeImageStrip from './RecipeImageStrip.svelte';
	import RecipeActionBar from './RecipeActionBar.svelte';
	import CookControlBar from './cook/CookControlBar.svelte';
	import ActiveTimersPanel from './cook/ActiveTimersPanel.svelte';

	interface Props {
		recipe: RecipeDisplay;
		scale: number;
		/** Unscaled, from the index -- `recipe.servings` has the scale applied. */
		baseServings: number | null;
		slug: string;
		/** The recipe's path within the recipe directory, shown in the title bar. */
		relPath?: string;
		image?: ImageRef | null;
		stepImages?: Record<string, ImageRef | null>;
		inShoppingList?: boolean;
		listedScale?: number | null;
	}

	const {
		recipe,
		scale,
		baseServings,
		slug,
		relPath = '',
		image = null,
		stepImages = {},
		inShoppingList = false,
		listedScale = null
	}: Props = $props();

	// URL-derived state
	const cookMode = $derived(page.url.searchParams.has('cook'));

	// The sidebar is a permanent pane from `lg`; below that it is a collapsed
	// panel, so the instructions keep the viewport rather than following a long
	// ingredient list.
	let detailsOpen = $state(false);
	let imgError = $state(false);
	const showImage = $derived(image !== null && !imgError);

	type PanelTab = 'details' | 'ingredients' | 'cookware';
	let panelTab = $state<PanelTab>('details');

	// Below `lg` the panel shows one of these at a time instead of stacking
	// everything, so a long ingredient list does not sit between the tabs and
	// the cookware. Empty panes are left out entirely.
	const panelTabs = $derived([
		{ id: 'details' as const, label: 'Details', icon: InfoIcon, count: null as number | null },
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
		if (!panelTabs.some((tab) => tab.id === panelTab)) panelTab = 'details';
	});

	function onTabKeydown(event: KeyboardEvent, index: number) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();

		const step = event.key === 'ArrowRight' ? 1 : -1;
		const next = (index + step + panelTabs.length) % panelTabs.length;
		panelTab = panelTabs[next].id;
		detailsOpen = true;

		const tabs = (
			event.currentTarget as HTMLElement
		).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
		tabs?.[next]?.focus();
	}

	/** A tab opens its pane; tapping the active tab again closes the panel. */
	function selectPanelTab(tab: PanelTab) {
		if (panelTab === tab && detailsOpen) {
			detailsOpen = false;
			return;
		}

		panelTab = tab;
		detailsOpen = true;
	}

	const servingsSummary = $derived.by(() => {
		const servings = recipe.servings;
		if (servings === undefined || servings === null || servings === '') return null;
		return `${servings} ${servings === 1 || servings === '1' ? 'serving' : 'servings'}`;
	});

	function minutes(value: number): string {
		if (value < 60) return `${value} min`;

		const hours = Math.floor(value / 60);
		const rest = value % 60;
		return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
	}

	const timeSummary = $derived.by(() => {
		const time = recipe.time;
		if (!time) return null;
		if (typeof time === 'number') return time > 0 ? minutes(time) : null;

		const total = (time.prep_time ?? 0) + (time.cook_time ?? 0);
		return total > 0 ? minutes(total) : null;
	});

	// Get step from URL or default to 1
	function getStepFromURL(): number {
		const stepParam = page.url.searchParams.get('step');
		return stepParam ? parseInt(stepParam, 10) || 1 : 1;
	}

	// The URL is the source of truth for the current step -- every navigation
	// control writes to it -- so this derives from the URL rather than keeping a
	// copy in $state and syncing it back with an effect.
	const currentStep = $derived(getStepFromURL());

	// Ephemeral hover state
	let hoveredIngredientIndex = $state<number | null>(null);
	let hoveredCookwareIndex = $state<number | null>(null);

	// Timer state
	let activeTimers = $state<ActiveTimer[]>([]);
	let audioEnabled = $state(true);
	let showTimersPanel = $state(false);

	// Timer tick effect
	$effect(() => {
		if (activeTimers.length === 0) return;

		const interval = setInterval(() => {
			let shouldAlert = false;
			activeTimers = activeTimers.map((timer) => {
				if (timer.status !== 'running' || timer.remainingSeconds <= 0) return timer;
				const newRemaining = timer.remainingSeconds - 1;
				if (newRemaining === 0) shouldAlert = true;
				return { ...timer, remainingSeconds: newRemaining };
			});
			if (shouldAlert && audioEnabled) playAlertSound();
		}, 1000);

		return () => clearInterval(interval);
	});

	// Flatten steps for index calculation
	const allSteps = $derived(
		recipe.sections.flatMap((section) =>
			section.content.filter((c): c is StepDisplay => c.type === 'step')
		)
	);

	const totalSteps = $derived(allSteps.length);

	// Get current step's ingredient/cookware indices
	const currentStepData = $derived(allSteps[currentStep - 1]);

	// $derived.by, not $derived(() => ...). The latter stores the function
	// itself, so every call site rebuilt the Set from scratch instead of
	// reading a memoized value.
	const currentStepIngredientIndices = $derived.by(() => {
		if (!cookMode || !currentStepData) return null;
		return new Set(
			currentStepData.items.filter((item) => item.type === 'ingredient').map((item) => item.index)
		);
	});

	const currentStepCookwareIndices = $derived.by(() => {
		if (!cookMode || !currentStepData) return null;
		return new Set(
			currentStepData.items.filter((item) => item.type === 'cookware').map((item) => item.index)
		);
	});

	// Active timer indices (for highlighting in steps)
	const activeTimerIndices = $derived(
		new Set(
			activeTimers
				.map((t) => t.id)
				.map((id) => {
					const parts = id.split('-');
					return parseInt(parts[parts.length - 1]);
				})
		)
	);

	// The parser rescales the recipe, so this is a navigation rather than local
	// state. `keepFocus` matters: the servings field applies as you type, and
	// without it every rescale would pull the caret out of the field you are
	// still typing in.
	function handleScale(newScale: number) {
		const url = new URL(page.url);
		url.searchParams.set('scale', String(newScale));
		goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	function toggleCookMode() {
		const url = new URL(page.url);
		if (cookMode) {
			url.searchParams.delete('cook');
			url.searchParams.delete('step');
			// Clear timers when exiting cook mode
			activeTimers = [];
			showTimersPanel = false;
		} else {
			url.searchParams.set('cook', '');
			url.searchParams.set('step', '1');
		}
		goto(url.toString(), { replaceState: true });
	}

	function goToStep(step: number) {
		const url = new URL(page.url);
		url.searchParams.set('step', String(step));
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function goToPreviousStep() {
		if (currentStep > 1) {
			goToStep(currentStep - 1);
		}
	}

	function goToNextStep() {
		if (currentStep < totalSteps) {
			goToStep(currentStep + 1);
		}
	}

	function finishCooking() {
		toggleCookMode();
	}

	// Timer controls
	function startTimer(index: number, name: string, quantity: string, stepNumber: number) {
		const totalSeconds = parseTimerQuantity(quantity);
		if (totalSeconds <= 0) return;

		const id = `timer-${stepNumber}-${index}`;

		// Don't add duplicate timers
		if (activeTimers.some((t) => t.id === id)) return;

		activeTimers = [
			...activeTimers,
			{
				id,
				name: name || `Timer (${quantity})`,
				totalSeconds,
				remainingSeconds: totalSeconds,
				status: 'running',
				stepNumber
			}
		];

		// Auto-show panel when first timer starts
		if (activeTimers.length === 1) {
			showTimersPanel = true;
		}
	}

	function pauseTimer(id: string) {
		activeTimers = activeTimers.map((t) => (t.id === id ? { ...t, status: 'paused' as const } : t));
	}

	function resumeTimer(id: string) {
		activeTimers = activeTimers.map((t) =>
			t.id === id ? { ...t, status: 'running' as const } : t
		);
	}

	function cancelTimer(id: string) {
		activeTimers = activeTimers.filter((t) => t.id !== id);
	}

	function toggleAudio() {
		audioEnabled = !audioEnabled;
	}

	function toggleTimersPanel() {
		showTimersPanel = !showTimersPanel;
	}

	// Keyboard navigation
	function handleKeydown(e: KeyboardEvent) {
		if (!cookMode) return;

		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			goToPreviousStep();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			goToNextStep();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			if (showTimersPanel) {
				showTimersPanel = false;
			} else {
				toggleCookMode();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Rendered in the workspace title bar. Cook mode has no action bar at all: its
     fixed control bar carries the only actions needed while cooking. -->
{#snippet actionBar()}
	<RecipeActionBar {slug} {scale} {inShoppingList} {listedScale} onstartcooking={toggleCookMode} />
{/snippet}

{#snippet recipePanes(tags: boolean)}
	<RecipeMeta {recipe} {baseServings} {scale} onscale={handleScale} showTags={tags} />
	<RecipeIngredients
		ingredients={recipe.ingredients}
		hoveredIndex={hoveredIngredientIndex}
		activeIndices={currentStepIngredientIndices}
		onhover={(i) => (hoveredIngredientIndex = i)}
	/>
	<RecipeCookware
		cookware={recipe.cookware}
		hoveredIndex={hoveredCookwareIndex}
		activeIndices={currentStepCookwareIndices}
		onhover={(i) => (hoveredCookwareIndex = i)}
	/>
{/snippet}

{#snippet steps()}
	<RecipeSteps
		sections={recipe.sections}
		{stepImages}
		{cookMode}
		{currentStep}
		{hoveredIngredientIndex}
		{hoveredCookwareIndex}
		activeIngredientIndices={currentStepIngredientIndices}
		activeCookwareIndices={currentStepCookwareIndices}
		{activeTimerIndices}
		onhoverIngredient={(i) => (hoveredIngredientIndex = i)}
		onhoverCookware={(i) => (hoveredCookwareIndex = i)}
		onstartTimer={startTimer}
	/>
{/snippet}

{#if cookMode}
	<!-- Cook mode stays a document rather than a workbench: it is full-bleed
	     with no rail or tabs, and nothing should be pinned around a step. -->
	<article class="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 pb-28 sm:px-6">
		<RecipeHeader {recipe} {image} />

		<div class="grid gap-6 lg:grid-cols-[300px_1fr]">
			<aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
				{@render recipePanes(false)}
			</aside>

			<main>
				{@render steps()}
			</main>
		</div>
	</article>
{:else}
	<!--
		The recipe as a workbench, matching the aisles, pantry, shopping list and
		editor: a title bar, a details/ingredients sidebar and an instructions
		pane share one frame with hairline dividers, and a status bar closes the
		bottom edge. Only the sidebar and the instructions scroll.
	-->
	<Page full flush class="flex h-full min-h-0 flex-col">
		<div
			class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
		>
			<!--
				On mobile the whole workbench scrolls as one column, so the cover
				image can move out of the way. The title bar sticks to the top.
			-->
			<div class="min-h-0 flex-1 overflow-y-auto lg:flex lg:flex-col lg:overflow-hidden">
				<!--
					The hero image moves out of the collapsed ingredients panel on
					phones and tablets. Above the title bar it reads as the recipe's
					cover; more than one scrolls sideways, never down the page.
				-->
				<RecipeImageStrip images={image ? [image] : []} title={recipe.title ?? 'Recipe'} />

				<header
					class="border-border bg-surface sticky top-0 z-20 flex shrink-0 flex-wrap items-center border-b md:gap-x-3 md:px-4 md:py-2 lg:static"
				>
					<div class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 md:px-0 md:py-0">
						<a
							href="/"
							class="text-fg-muted hover:text-fg inline-flex shrink-0 items-center gap-1 text-sm font-medium transition-colors duration-150"
						>
							<ArrowLeftIcon class="size-4" />
							<span class="hidden sm:inline">Recipes</span>
							<span class="sr-only sm:hidden">Back to recipes</span>
						</a>

						<span class="bg-border hidden h-5 w-px sm:block" aria-hidden="true"></span>

						<div class="min-w-0 flex-1">
							<h1
								class="text-fg truncate text-base font-semibold"
								title={recipe.title ?? 'Untitled Recipe'}
							>
								{recipe.title ?? 'Untitled Recipe'}
							</h1>
							{#if relPath}
								<p class="text-fg-subtle truncate text-xs" title={relPath}>{relPath}</p>
							{/if}
						</div>
					</div>

					<!--
					A toolbar strip of its own on phones and tablets, where sharing a
					row with the title left no room for either. It sits inline at the
					right of the title bar from `md` up.
				-->
					<div
						class="border-border bg-surface-muted/30 flex w-full min-w-0 items-center justify-end border-t px-3 py-1.5 md:ml-auto md:w-auto md:shrink-0 md:border-t-0 md:bg-transparent md:px-0 md:py-0"
					>
						{@render actionBar()}
					</div>
				</header>

				<div
					class="grid min-h-0 flex-1 grid-rows-[auto_auto] lg:grid-cols-[21rem_minmax(0,1fr)] lg:grid-rows-1"
				>
					<!-- The sidebar is the permanent pane from `lg`. Below that it collapses
				     to its tab bar, the way the shopping list's recipe pane does, so a
				     long ingredient list never stands between you and the first step. -->
					<aside
						class="border-border bg-surface-muted/40 order-1 min-h-0 overflow-hidden border-b lg:h-auto lg:border-r lg:border-b-0"
					>
						<div class="flex h-full min-h-0 flex-col">
							<!--
							The tab strip replaces the old "Ingredients & details" bar. It
							mirrors the preview bar in the recipe editor: tabs choose the
							pane, and the active tab, the chevron or the empty strip all
							collapse it.
						-->
							<div
								class="border-border bg-surface-muted/40 hover:bg-surface-muted/70 relative flex items-center gap-1 px-1 transition-colors duration-100 lg:hidden"
							>
								<button
									type="button"
									tabindex="-1"
									aria-hidden="true"
									class="absolute inset-0 z-0 cursor-pointer"
									onclick={() => (detailsOpen = !detailsOpen)}
								></button>

								<div
									class="no-scrollbar relative z-10 flex min-w-0 items-center gap-0.5 overflow-x-auto"
									role="tablist"
									aria-label="Recipe details"
								>
									{#each panelTabs as tab, index (tab.id)}
										<button
											type="button"
											role="tab"
											id="recipe-tab-{tab.id}"
											aria-selected={panelTab === tab.id}
											aria-controls="recipe-panel"
											tabindex={panelTab === tab.id ? 0 : -1}
											class="flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium transition-colors duration-100 {panelTab ===
											tab.id
												? 'text-fg'
												: 'text-fg-muted hover:text-fg'} {panelTab === tab.id && detailsOpen
												? 'border-accent'
												: 'border-transparent'}"
											onclick={() => selectPanelTab(tab.id)}
											onkeydown={(event) => onTabKeydown(event, index)}
										>
											<tab.icon class="size-3.5" />
											{tab.label}
											{#if tab.count !== null}
												<span class="text-fg-subtle tabular-nums">{tab.count}</span>
											{/if}
										</button>
									{/each}
								</div>

								<button
									type="button"
									class="text-fg-subtle hover:text-fg relative z-10 ml-auto shrink-0 rounded p-1.5 transition-colors duration-100"
									aria-expanded={detailsOpen}
									aria-controls="recipe-panel"
									aria-label={detailsOpen
										? 'Collapse ingredients and details'
										: 'Expand ingredients and details'}
									onclick={() => (detailsOpen = !detailsOpen)}
								>
									{#if detailsOpen}
										<ChevronDownIcon class="size-3.5" aria-hidden="true" />
									{:else}
										<ChevronUpIcon class="size-3.5" aria-hidden="true" />
									{/if}
								</button>
							</div>

							<div
								id="recipe-panel"
								class="border-border max-h-64 overflow-y-auto border-t lg:hidden {detailsOpen
									? 'block'
									: 'hidden'}"
								role="tabpanel"
								aria-labelledby="recipe-tab-{panelTab}"
							>
								{#if panelTab === 'details'}
									{#if recipe.description}
										<div class="border-border border-b px-4 py-3">
											<p class="text-fg-muted text-sm">{recipe.description}</p>
										</div>
									{/if}
									<RecipeMeta
										{recipe}
										{baseServings}
										{scale}
										onscale={handleScale}
										header={false}
									/>
								{:else if panelTab === 'ingredients'}
									<RecipeIngredients
										ingredients={recipe.ingredients}
										hoveredIndex={hoveredIngredientIndex}
										activeIndices={currentStepIngredientIndices}
										onhover={(i) => (hoveredIngredientIndex = i)}
										header={false}
									/>
								{:else}
									<RecipeCookware
										cookware={recipe.cookware}
										hoveredIndex={hoveredCookwareIndex}
										activeIndices={currentStepCookwareIndices}
										onhover={(i) => (hoveredCookwareIndex = i)}
										header={false}
									/>
								{/if}
							</div>

							<!-- Desktop keeps all three panes stacked, as before. -->
							<div class="hidden min-h-0 flex-1 overflow-y-auto lg:block">
								{#if showImage && image}
									<img
										src={image.src}
										srcset={image.srcset}
										width={image.width}
										height={image.height}
										onerror={() => (imgError = true)}
										fetchpriority="high"
										decoding="async"
										alt={recipe.title ?? 'Recipe'}
										class="border-border block aspect-[16/9] w-full border-b object-cover"
									/>
								{/if}

								{#if recipe.description}
									<div class="border-border border-b px-4 py-3">
										<p class="text-fg-muted text-sm">{recipe.description}</p>
									</div>
								{/if}

								{@render recipePanes(true)}
							</div>
						</div>
					</aside>

					<section class="order-2 flex min-h-0 min-w-0 flex-col" aria-label="Instructions">
						<div
							class="border-border flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2"
						>
							<h2 class="text-fg flex items-baseline gap-2 text-sm font-semibold">
								<ListOrderedIcon class="text-fg-subtle size-4 self-center" />
								Instructions
								<span class="text-fg-subtle text-xs font-normal tabular-nums">
									{totalSteps}
									{totalSteps === 1 ? 'step' : 'steps'}
								</span>
							</h2>

							{#if timeSummary}
								<span class="text-fg-subtle ml-auto text-xs tabular-nums">{timeSummary}</span>
							{/if}
						</div>

						<div class="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
							{@render steps()}
						</div>
					</section>
				</div>
			</div>

			<footer
				class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-1.5 text-xs"
			>
				{#if servingsSummary}
					<span class="tabular-nums">{servingsSummary}</span>
					<span class="text-border" aria-hidden="true">·</span>
				{/if}
				{#if timeSummary}
					<span class="tabular-nums">{timeSummary}</span>
					<span class="text-border" aria-hidden="true">·</span>
				{/if}
				<span class="tabular-nums">
					{recipe.ingredients.length}
					{recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
				</span>
				<span class="text-border" aria-hidden="true">·</span>
				<span class="tabular-nums">
					{recipe.cookware.length}
					cookware
				</span>
				<span class="text-border" aria-hidden="true">·</span>
				<span class="tabular-nums">
					{totalSteps}
					{totalSteps === 1 ? 'step' : 'steps'}
				</span>

				{#if scale !== 1}
					<span class="ml-auto tabular-nums">{formatScale(scale)}× scale</span>
				{/if}
			</footer>
		</div>
	</Page>
{/if}

{#if cookMode}
	<CookControlBar
		{currentStep}
		{totalSteps}
		activeTimerCount={activeTimers.length}
		onprevious={goToPreviousStep}
		onnext={goToNextStep}
		onfinish={finishCooking}
		ontoggletimers={toggleTimersPanel}
	/>
{/if}

{#if showTimersPanel}
	<ActiveTimersPanel
		timers={activeTimers}
		{audioEnabled}
		onclose={() => (showTimersPanel = false)}
		ontoggleaudio={toggleAudio}
		onpause={pauseTimer}
		onresume={resumeTimer}
		oncancel={cancelTimer}
	/>
{/if}
