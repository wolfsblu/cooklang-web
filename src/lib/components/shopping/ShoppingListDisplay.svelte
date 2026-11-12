<script lang="ts">
	import { CheckIcon, ListChecksIcon, MinusIcon, RotateCcwIcon } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		UNCATEGORIZED,
		type ShoppingListCategory,
		type ShoppingListDisplay
	} from '$lib/types/shopping-list';
	import ShoppingAislePicker from './ShoppingAislePicker.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';

	interface Props {
		shoppingList: ShoppingListDisplay | null;
		loading?: boolean;
		/** Aisles offered for anything the config could not place. */
		aisleCategories?: string[];
		returnTo?: string;
	}

	let {
		shoppingList,
		loading = false,
		aisleCategories = [],
		returnTo = '/shopping'
	}: Props = $props();

	/**
	 * Ticking items off is still client-only — it is state about one shopping
	 * trip, not something to write to the recipe directory. It is persisted to
	 * sessionStorage so a refresh mid-trip does not lose the progress, and it
	 * is cleared whenever the generated list itself changes.
	 */
	const STORAGE_KEY = 'cooklang:shopping-checked';

	// SvelteSet rather than Set: this is reactive state, and a plain Set would
	// not notify on mutation, forcing a wholesale replacement on every tick.
	const checked = new SvelteSet<string>();
	let checkedFor = $state('');

	/**
	 * The signature covers item names, not just counts, so adding a recipe that
	 * swaps one ingredient for another still resets the ticks.
	 */
	const listSignature = $derived(
		shoppingList?.categories
			.map((category) => `${category.name}:${category.items.map((item) => item.name).join(',')}`)
			.join('|') ?? ''
	);

	const allKeys = $derived(
		new Set(
			shoppingList?.categories.flatMap((category) =>
				category.items.map((item) => `${category.name}/${item.name}`)
			) ?? []
		)
	);

	const total = $derived(shoppingList?.totalItems ?? 0);
	const checkedCount = $derived([...checked].filter((key) => allKeys.has(key)).length);
	const remaining = $derived(total - checkedCount);
	const progress = $derived(total === 0 ? 0 : checkedCount / total);
	const percent = $derived(Math.round(progress * 100));
	const allDone = $derived(total > 0 && checkedCount === total);

	/**
	 * The toast is a moment, not a permanent banner: it announces the finish
	 * from wherever the shopper is, then gets out of the way.
	 */
	let showCompleteToast = $state(false);

	$effect(() => {
		if (!allDone) {
			showCompleteToast = false;
			return;
		}

		showCompleteToast = true;
		const timer = setTimeout(() => (showCompleteToast = false), 6000);
		return () => clearTimeout(timer);
	});

	const message = $derived.by(() => {
		if (allDone) return 'Basket packed — nice work!';
		if (checkedCount === 0) return 'Tick items off as they go in your basket.';
		if (remaining === 1) return 'Just one item to go.';
		if (progress >= 0.75) return `Almost there — ${remaining} to go.`;
		if (progress >= 0.5) return `Over halfway — ${remaining} to go.`;
		return `Nice start — ${remaining} to go.`;
	});

	const RING_RADIUS = 17;
	const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

	// Fixed rather than random so the burst is identical on every run (and does
	// not differ between the server render and hydration).
	const CONFETTI = [
		{ dx: -52, dy: -34, rot: -170, delay: 0, color: 'var(--color-brand-500)' },
		{ dx: 44, dy: -40, rot: 150, delay: 20, color: 'var(--color-herb-500)' },
		{ dx: -28, dy: -54, rot: -110, delay: 10, color: 'var(--color-warn-500)' },
		{ dx: 30, dy: -56, rot: 200, delay: 60, color: 'var(--color-brand-400)' },
		{ dx: -64, dy: 2, rot: -90, delay: 40, color: 'var(--color-herb-500)' },
		{ dx: 62, dy: 6, rot: 120, delay: 10, color: 'var(--color-warn-500)' },
		{ dx: -44, dy: 34, rot: 170, delay: 70, color: 'var(--color-brand-500)' },
		{ dx: 42, dy: 32, rot: -150, delay: 30, color: 'var(--color-herb-500)' },
		{ dx: 2, dy: -64, rot: 40, delay: 50, color: 'var(--color-brand-400)' },
		{ dx: 18, dy: -48, rot: 230, delay: 80, color: 'var(--color-warn-500)' },
		{ dx: -14, dy: -46, rot: -210, delay: 20, color: 'var(--color-herb-500)' },
		{ dx: 56, dy: -18, rot: 100, delay: 90, color: 'var(--color-brand-500)' },
		{ dx: -56, dy: -16, rot: -140, delay: 60, color: 'var(--color-warn-500)' },
		{ dx: 8, dy: 44, rot: 190, delay: 40, color: 'var(--color-brand-400)' }
	];

	function readSaved(signature: string): string[] {
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY);
			if (!raw) return [];
			const saved = JSON.parse(raw) as { signature?: string; keys?: string[] };
			return saved.signature === signature && Array.isArray(saved.keys) ? saved.keys : [];
		} catch {
			return [];
		}
	}

	$effect(() => {
		if (checkedFor === listSignature) return;

		checkedFor = listSignature;
		checked.clear();
		if (!listSignature) return;

		// Restoring here (rather than in onMount) keeps the reset and the
		// restore in one place: there is never a frame with the old ticks.
		for (const key of readSaved(listSignature)) {
			if (allKeys.has(key)) checked.add(key);
		}
	});

	$effect(() => {
		// Subscribe to every tick so the saved copy follows the on-screen one.
		const keys = [...checked];
		if (!checkedFor || checkedFor !== listSignature) return;
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ signature: listSignature, keys }));
		} catch {
			// Private mode or a full quota: ticking still works for this visit.
		}
	});

	function doneIn(category: ShoppingListCategory): number {
		let count = 0;
		for (const item of category.items) {
			if (checked.has(`${category.name}/${item.name}`)) count++;
		}
		return count;
	}

	function toggle(key: string) {
		if (checked.has(key)) {
			checked.delete(key);
			return;
		}

		checked.add(key);
		// The physical half of "done" on phones that support it; desktop
		// browsers simply ignore the call.
		navigator.vibrate?.(8);
	}

	/**
	 * Ticking an aisle from its heading is all-or-nothing: if anything is still
	 * left, complete the aisle; otherwise clear it.
	 */
	function toggleCategory(category: ShoppingListCategory) {
		const complete = doneIn(category) === category.items.length;

		for (const item of category.items) {
			const key = `${category.name}/${item.name}`;
			if (complete) checked.delete(key);
			else checked.add(key);
		}

		if (!complete) navigator.vibrate?.(8);
	}
</script>

{#if loading}
	<div class="flex items-center justify-center gap-3 px-4 py-12">
		<Spinner label="Generating shopping list" />
		<span class="text-fg-muted">Generating shopping list…</span>
	</div>
{:else if !shoppingList || shoppingList.categories.length === 0}
	<EmptyState
		icon={ListChecksIcon}
		title="Nothing to buy yet"
		description="Add recipes to generate a shopping list."
	/>
{:else}
	<div>
		<!-- Trip progress: the reason to come back to the page mid-shop. This is
		     a workbench strip rather than a floating card; the aisle sections
		     below supply the divider. -->
		<section
			class="relative overflow-hidden p-4 transition-colors duration-300 sm:p-5 {allDone
				? 'bg-ok-soft/40'
				: 'bg-surface'}"
			aria-label="Shopping progress"
		>
			<div class="flex flex-wrap items-center gap-4">
				<div class="relative flex size-16 shrink-0 items-center justify-center">
					<svg viewBox="0 0 40 40" class="size-16 -rotate-90" aria-hidden="true">
						<circle
							cx="20"
							cy="20"
							r={RING_RADIUS}
							fill="none"
							stroke="currentColor"
							stroke-width="3.5"
							class="text-surface-muted"
						/>
						<circle
							cx="20"
							cy="20"
							r={RING_RADIUS}
							fill="none"
							stroke="currentColor"
							stroke-width="3.5"
							stroke-linecap="round"
							stroke-dasharray={RING_LENGTH}
							stroke-dashoffset={RING_LENGTH * (1 - progress)}
							class="transition-all duration-500 ease-out {allDone ? 'text-ok' : 'text-accent'}"
						/>
					</svg>

					<span class="absolute inset-0 flex items-center justify-center">
						{#if allDone}
							<CheckIcon class="text-ok size-7" strokeWidth={2.5} />
						{:else}
							<span class="text-sm font-semibold tabular-nums">{percent}%</span>
						{/if}
					</span>

					{#if allDone}
						<div class="pointer-events-none absolute inset-0" aria-hidden="true">
							{#each CONFETTI as piece, index (index)}
								<span
									class="confetti-piece"
									style="--dx: {piece.dx}px; --dy: {piece.dy}px; --rot: {piece.rot}deg; --delay: {piece.delay}ms; background-color: {piece.color}"
								></span>
							{/each}
						</div>
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<p class="text-fg text-xl font-semibold tabular-nums">
						{checkedCount}<span class="text-fg-muted text-base font-medium">&nbsp;of {total}</span>
						picked up
					</p>
					<p class="text-fg-muted text-sm" aria-live="polite">{message}</p>
				</div>

				{#if checkedCount > 0}
					<Button variant="ghost" size="sm" onclick={() => checked.clear()}>
						<RotateCcwIcon class="size-4" />
						Uncheck all
					</Button>
				{/if}
			</div>

			<div
				class="bg-surface-muted mt-4 h-2 overflow-hidden rounded-full"
				role="progressbar"
				aria-label="Items picked up"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div
					class="h-full rounded-full transition-all duration-500 ease-out {allDone
						? 'bg-ok'
						: 'bg-accent'}"
					style="width: {progress * 100}%"
				></div>
			</div>
		</section>

		<!--
			Aisles are tiles, not headings in one long list: it gives each group a
			visible finish line, and two columns use the width the old single
			column left empty. Columns rather than a grid so tiles of different
			heights pack without ragged gaps.
		-->
		<div class="@container">
			<div
				class="columns-1 [column-gap:0] [column-rule:1px_solid_var(--color-border)] @2xl:columns-2 @5xl:columns-3 @7xl:columns-4 @min-[100rem]:columns-5"
			>
				{#each shoppingList.categories as category (category.name)}
					{@const done = doneIn(category)}
					{@const categoryDone = done === category.items.length}
					{@const placeable = category.name === UNCATEGORIZED && aisleCategories.length > 0}
					<!-- A placeable aisle carries a select and a button in every row,
					     which leaves no room for the name inside a column. -->
					<section
						class="border-border break-inside-avoid border-t {placeable ? '[column-span:all]' : ''}"
					>
						<header class="bg-surface-muted/40 flex items-center justify-between gap-3 px-4 py-2">
							<h3 class="min-w-0 flex-1 text-sm font-semibold">
								<!-- The aisle heading doubles as a select-all: an empty circle
								     when nothing is ticked, a dash when some are, a check when
								     the whole aisle is done. -->
								<button
									type="button"
									role="checkbox"
									aria-checked={categoryDone ? true : done > 0 ? 'mixed' : false}
									aria-label={categoryDone
										? `Uncheck all in ${category.displayName}`
										: `Check off all in ${category.displayName}`}
									title={categoryDone ? 'Uncheck this aisle' : 'Check off this aisle'}
									onclick={() => toggleCategory(category)}
									class="group/all hover:bg-surface-muted -ml-1 flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left transition-colors"
								>
									<span
										class="group-hover/all:border-ok flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ease-out group-active/all:scale-90 {categoryDone
											? 'border-ok bg-ok text-ok-fg'
											: done > 0
												? 'border-ok bg-surface text-ok'
												: 'border-border-strong bg-surface'}"
										aria-hidden="true"
									>
										{#if categoryDone}
											<CheckIcon class="size-3.5" strokeWidth={3.5} />
										{:else if done > 0}
											<MinusIcon class="size-3.5" strokeWidth={3.5} />
										{/if}
									</span>
									<span class="min-w-0">{category.displayName}</span>
								</button>
							</h3>
							<span
								class="shrink-0 text-xs font-medium tabular-nums {categoryDone
									? 'text-ok'
									: 'text-fg-subtle'}"
							>
								{done}/{category.items.length}
							</span>
						</header>

						<div class="bg-surface-muted h-1 w-full" aria-hidden="true">
							<div
								class="bg-ok h-full transition-[width] duration-500 ease-out"
								style="width: {(done / category.items.length) * 100}%"
							></div>
						</div>

						{#if placeable}
							<p class="text-fg-muted px-4 pt-3 text-xs">
								Not in your <a href="/aisles/unassigned" class="link">aisles</a> yet. Give each one an
								aisle and it will be grouped with the rest next time.
							</p>
						{/if}

						<ul class="space-y-0.5 p-2">
							{#each category.items as item (item.name)}
								{@const key = `${category.name}/${item.name}`}
								{@const isChecked = checked.has(key)}
								<li
									class="flex flex-wrap items-center gap-x-2 rounded-sm transition-colors duration-200 {isChecked
										? 'bg-ok-soft/60'
										: 'hover:bg-surface-muted'}"
								>
									<!-- The picker is a sibling of the label, never inside it: a
									     select nested in a label ticks the checkbox on every click
									     that opens the dropdown. -->
									<label
										class="group flex min-w-52 flex-1 cursor-pointer items-center gap-3 rounded-sm px-2 py-2"
									>
										<input
											type="checkbox"
											class="peer sr-only"
											checked={isChecked}
											onchange={() => toggle(key)}
										/>

										<!-- The native box is hidden, so this is the visible one; the
										     peer variants keep its keyboard focus ring reachable. -->
										<span
											class="peer-focus-visible:ring-ring peer-focus-visible:ring-offset-surface group-hover:border-ok flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ease-out group-active:scale-90 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 {isChecked
												? 'border-ok bg-ok text-ok-fg'
												: 'border-border-strong bg-surface'}"
											aria-hidden="true"
										>
											<CheckIcon
												class="size-3.5 transition-transform duration-200 ease-out {isChecked
													? 'scale-100'
													: 'scale-0'}"
												strokeWidth={3.5}
											/>
										</span>

										<span class="min-w-0 flex-1">
											<!-- Inline, so the strike background paints per line box when a
											     long name wraps. -->
											<span class="strike {isChecked ? 'struck text-fg-muted' : 'text-fg'}"
												>{item.displayName}</span
											>
										</span>

										{#if item.quantity}
											<span
												class="text-fg-muted shrink-0 text-right text-sm tabular-nums transition-colors duration-200"
											>
												{item.quantity}
											</span>
										{/if}
									</label>

									{#if placeable}
										<div class="ml-auto">
											<ShoppingAislePicker
												itemName={item.name}
												categories={aisleCategories}
												{returnTo}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</div>

		<!-- Status bar, in the spirit of the editor's: a quiet summary along the
		     bottom edge of the workbench. -->
		<footer
			class="border-border text-fg-subtle flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5 text-xs"
		>
			<span class="inline-flex items-center gap-1.5 tabular-nums">
				{#if allDone}
					<CheckIcon class="text-ok size-3.5" strokeWidth={3} />
				{/if}
				{checkedCount}/{total} picked up
			</span>
			<span class="tabular-nums">{shoppingList.categories.length} aisles</span>
			<span class="tabular-nums">
				{shoppingList.recipeCount}
				{shoppingList.recipeCount === 1 ? 'recipe' : 'recipes'}
			</span>
			<span class="ml-auto tabular-nums">{allDone ? 'All done' : `${remaining} to go`}</span>
		</footer>
	</div>

	{#if showCompleteToast}
		<!-- The hero may be scrolled away by the time the last item is ticked,
		     so the celebration follows the shopper to wherever they are. -->
		<div
			class="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6"
			role="status"
		>
			<div
				class="trip-toast bg-ok text-ok-fg shadow-pop flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
			>
				<CheckIcon class="size-4" strokeWidth={3} />
				All {total} items in the basket
			</div>
		</div>
	{/if}
{/if}

<style>
	.strike {
		background-image: linear-gradient(currentColor, currentColor);
		background-repeat: no-repeat;
		background-position: 0 58%;
		background-size: 0% 1.5px;
		transition:
			background-size 280ms ease-out,
			color 200ms ease-out;
	}

	.strike.struck {
		background-size: 100% 1.5px;
	}

	.confetti-piece {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 6px;
		height: 10px;
		border-radius: 2px;
		animation: confetti-burst 900ms cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
		animation-delay: var(--delay);
	}

	@keyframes confetti-burst {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) rotate(0deg) scale(0.6);
		}
		15% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot))
				scale(1);
		}
	}

	.trip-toast {
		animation: trip-toast-in 300ms cubic-bezier(0.2, 0.7, 0.3, 1);
	}

	@keyframes trip-toast-in {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.96);
		}
	}
</style>
