<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ArrowRightIcon,
		CheckIcon,
		ChevronDownIcon,
		CircleCheckIcon,
		FlameIcon,
		SignpostIcon,
		SparklesIcon,
		TriangleAlertIcon
	} from '@lucide/svelte';
	import { onDestroy } from 'svelte';
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

	/**
	 * The unassigned count when this page was opened. Enhanced submissions
	 * update the item list in place rather than remounting the component, so
	 * the sorted count keeps rising instead of resetting after every
	 * assignment.
	 */
	// svelte-ignore state_referenced_locally
	let baseline = $state(items.length);

	const remaining = $derived(items.length);
	const sorted = $derived(Math.max(0, baseline - remaining));
	const progress = $derived(baseline === 0 ? 0 : Math.min(1, sorted / baseline));
	const percent = $derived(Math.round(progress * 100));

	const message = $derived.by(() => {
		if (remaining === 1) return 'Just one left — give it an aisle.';
		if (sorted === 0) return 'Pick an aisle for each ingredient and it disappears from here.';
		if (progress >= 0.75) return `Almost there — ${remaining} to go.`;
		if (progress >= 0.5) return `Over halfway — ${remaining} to go.`;
		return `Nice — ${sorted} sorted. ${remaining} to go.`;
	});

	const RING_RADIUS = 17;
	const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

	/** A small, fixed burst so the finish looks the same on every render. */
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

	// A shorter burst for the toast, so a single assignment still feels like a
	// win without drowning out the message.
	const TOAST_CONFETTI = [
		{ dx: -38, dy: -28, rot: -120, delay: 0, color: 'var(--color-brand-400)' },
		{ dx: 36, dy: -30, rot: 100, delay: 20, color: 'var(--color-herb-400)' },
		{ dx: -46, dy: 2, rot: -80, delay: 10, color: 'var(--color-warn-500)' },
		{ dx: 46, dy: 6, rot: 90, delay: 30, color: 'var(--color-brand-500)' },
		{ dx: -24, dy: 34, rot: 120, delay: 40, color: 'var(--color-herb-400)' },
		{ dx: 24, dy: 32, rot: -140, delay: 10, color: 'var(--color-warn-500)' },
		{ dx: 2, dy: -42, rot: 30, delay: 50, color: 'var(--color-brand-400)' },
		{ dx: 8, dy: 38, rot: 160, delay: 20, color: 'var(--color-herb-400)' },
		{ dx: -52, dy: -14, rot: -170, delay: 35, color: 'var(--color-brand-500)' },
		{ dx: 52, dy: -18, rot: 150, delay: 45, color: 'var(--color-warn-500)' },
		{ dx: -12, dy: -50, rot: -40, delay: 25, color: 'var(--color-herb-400)' },
		{ dx: 18, dy: 46, rot: 200, delay: 55, color: 'var(--color-brand-400)' }
	];

	type Notice = { tone: 'ok' | 'danger'; message: string; celebrate?: boolean; id: number };

	let notice = $state<Notice | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	let noticeSeq = 0;

	function showNotice(next: Omit<Notice, 'id'>) {
		clearTimeout(noticeTimer);
		// The id remounts the burst and check pop, so two assignments in a row
		// each get their own animation instead of reusing the finished one.
		notice = { ...next, id: ++noticeSeq };
		noticeTimer = setTimeout(() => (notice = null), 4500);
	}

	onDestroy(() => clearTimeout(noticeTimer));

	/** Which item (and which of its two actions) is mid-flight. */
	let pending = $state<{ name: string; alias: boolean } | null>(null);
	/** The item playing its success flash before it is removed from the list. */
	let celebrating = $state<string | null>(null);

	/**
	 * Shared by the per-item assign form and its "Same as…" alias shortcut.
	 * The feedback lives here rather than in the action because the action
	 * redirects: the success is the item disappearing, and the toast names what
	 * just happened before the list reflows beneath it.
	 */
	const submit: SubmitFunction = ({ formData }) => {
		const name = String(formData.get('name') ?? '');
		const category = String(formData.get('category') ?? '');
		const aliasOf = formData.get('aliasOf');
		const alias = typeof aliasOf === 'string' && aliasOf.length > 0;

		pending = { name, alias };
		// It may already be gone after the update; keeping it would leave the
		// bulk bar showing a phantom selection.
		selected.delete(name);

		return async ({ result, update }) => {
			try {
				if (result.type === 'failure') {
					await update();
					const detail = (result.data as { message?: string } | undefined)?.message;
					showNotice({ tone: 'danger', message: detail ?? `Could not assign ${name}.` });
					return;
				}

				if (result.type === 'success' || result.type === 'redirect') {
					navigator.vibrate?.(8);
					showNotice({
						tone: 'ok',
						celebrate: true,
						message: alias ? `“${name}” now matches ${aliasOf}.` : `“${name}” → ${category}`
					});

					// Hold the card for one beat so its success flash and burst are
					// actually seen before the list reflows around the gap.
					celebrating = name;
					await new Promise((resolve) => setTimeout(resolve, 400));
				}

				await update();
			} finally {
				pending = null;
				celebrating = null;
			}
		};
	};

	function afterBulkAssign() {
		const count = selected.size;
		selected.clear();
		navigator.vibrate?.(12);
		showNotice({
			tone: 'ok',
			message: count === 1 ? '1 ingredient sorted.' : `${count} ingredients sorted.`
		});
	}
</script>

<div class="flex h-full min-h-0 flex-col">
	{#if categories.length === 0}
		<div class="min-h-0 flex-1 overflow-y-auto">
			<EmptyState
				icon={SignpostIcon}
				title="Create an aisle first"
				description="Unassigned ingredients need somewhere to go. Add an aisle, then come back and sort {items.length}
				{items.length === 1 ? 'ingredient' : 'ingredients'} in one pass."
			>
				{#snippet actions()}
					<Button href="/aisles">Manage aisles</Button>
				{/snippet}
			</EmptyState>
		</div>
	{:else if items.length === 0}
		<!-- Finished in-session versus arrived-empty are different moments: only
		     the first deserves the confetti. -->
		<div
			class="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
		>
			<div class="bg-ok-soft relative flex size-20 items-center justify-center rounded-full">
				<span class="flex" class:success-pop={sorted > 0}>
					<CircleCheckIcon class="text-ok size-10" strokeWidth={2} />
				</span>
				{#if sorted > 0}
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

			<p class="text-fg mt-4 text-xl font-semibold">
				{sorted > 0 ? 'All sorted!' : 'Every ingredient has an aisle'}
			</p>
			<p class="text-fg-muted mt-1 max-w-prose text-sm">
				{#if sorted > 0}
					You placed {sorted}
					{sorted === 1 ? 'ingredient' : 'ingredients'}. Shopping lists can now group everything by
					aisle.
				{:else}
					Nothing in your recipes falls through to “Other”.
				{/if}
			</p>
			<div class="mt-5 flex flex-wrap items-center justify-center gap-2">
				<Button href="/aisles/ingredients" variant="outline" size="sm">Browse aisles</Button>
				<Button href="/shopping" size="sm">Shopping list</Button>
			</div>
		</div>
	{:else}
		<!-- Progress, in the same spirit as the shopping list: the reason to
		     keep sorting is visible at a glance, wherever you are in the list. -->
		<section class="bg-surface shrink-0 px-4 py-3 sm:px-5 sm:py-4" aria-label="Assignment progress">
			<div class="flex items-center gap-3 sm:gap-4">
				<div class="relative flex size-14 shrink-0 items-center justify-center sm:size-16">
					<svg viewBox="0 0 40 40" class="size-14 -rotate-90 sm:size-16" aria-hidden="true">
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
							class="text-accent transition-all duration-500 ease-out"
						/>
					</svg>

					<span class="absolute inset-0 flex items-center justify-center">
						<span class="text-sm font-semibold tabular-nums">{percent}%</span>
					</span>
				</div>

				<div class="min-w-0 flex-1">
					<p class="text-fg text-lg font-semibold sm:text-xl">
						{remaining}
						{remaining === 1 ? 'ingredient' : 'ingredients'} left to sort
					</p>
					<p class="text-fg-muted text-sm" aria-live="polite">{message}</p>
				</div>

				{#if sorted > 0}
					<div
						class="text-ok-soft-fg bg-ok-soft hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums sm:inline-flex"
					>
						<CheckIcon class="size-3.5" strokeWidth={3} />
						{sorted} sorted
					</div>
				{/if}
			</div>

			<div class="mt-3 flex items-center gap-3">
				<div
					class="bg-surface-muted h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
					role="progressbar"
					aria-label="Ingredients sorted"
					aria-valuenow={percent}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div
						class="bg-accent h-full rounded-full transition-all duration-500 ease-out"
						style="width: {progress * 100}%"
					></div>
				</div>
				<span class="text-fg-subtle shrink-0 text-xs tabular-nums">
					{sorted}/{baseline}
				</span>
			</div>
		</section>

		<div
			class="border-border bg-surface-muted/40 flex shrink-0 items-center gap-3 border-y px-4 py-2"
		>
			<button
				type="button"
				onclick={toggleAll}
				aria-pressed={allSelected}
				class="text-fg-muted hover:text-fg group inline-flex items-center gap-2 text-sm transition-colors"
			>
				<span
					class="flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ease-out group-active:scale-90 {allSelected
						? 'border-accent bg-accent text-accent-fg'
						: 'border-border-strong bg-surface'}"
					aria-hidden="true"
				>
					<CheckIcon
						class="size-3.5 transition-transform duration-200 ease-out {allSelected
							? 'scale-100'
							: 'scale-0'}"
						strokeWidth={3.5}
					/>
				</span>
				{allSelected ? 'Clear selection' : `Select all ${items.length}`}
			</button>

			<span class="text-fg-subtle ml-auto hidden items-center gap-1.5 text-xs sm:inline-flex">
				<FlameIcon class="size-3.5" />
				Most-used first
			</span>
		</div>

		<!-- Cards in a grid rather than columns: rows share a height, so the
		     controls in neighbouring cards line up instead of drifting with
		     each card's content. -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			<div class="bg-surface-muted/20 @container min-h-full p-3 sm:p-4">
				<div class="grid grid-cols-1 gap-3 @3xl:grid-cols-2 @5xl:grid-cols-3">
					{#each items as item (item.name)}
						{@const isSelected = selected.has(item.name)}
						{@const isCelebrating = celebrating === item.name}
						<article
							class="border-border bg-surface relative flex h-full flex-col rounded-lg border p-3 transition-colors duration-150 sm:p-4 {isCelebrating
								? 'border-ok bg-ok-soft/40'
								: isSelected
									? 'border-accent'
									: 'hover:border-border-strong'}"
							class:card-celebrate={isCelebrating}
							data-testid="unassigned-item"
						>
							{#if isCelebrating}
								<span class="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
									{#each CONFETTI as piece, index (index)}
										<span
											class="confetti-piece"
											style="--dx: {piece.dx}px; --dy: {piece.dy}px; --rot: {piece.rot}deg; --delay: {piece.delay}ms; background-color: {piece.color}"
										></span>
									{/each}
								</span>
							{/if}
							<label class="group -m-1 flex cursor-pointer items-start gap-3 rounded-md p-1">
								<!-- The real bulk-form input, associated with the sticky bar's
								     form by id so it submits from here in the tile. -->
								<input
									type="checkbox"
									name="name"
									value={item.name}
									form="aisle-bulk-assign"
									checked={isSelected}
									onchange={(event) =>
										event.currentTarget.checked
											? selected.add(item.name)
											: selected.delete(item.name)}
									class="peer sr-only"
									aria-label="Select {item.name}"
								/>

								<span
									class="peer-focus-visible:ring-ring peer-focus-visible:ring-offset-surface mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ease-out group-active:scale-90 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 {isSelected
										? 'border-accent bg-accent text-accent-fg'
										: 'border-border-strong bg-surface group-hover:border-accent'}"
									aria-hidden="true"
								>
									<CheckIcon
										class="size-3.5 transition-transform duration-200 ease-out {isSelected
											? 'scale-100'
											: 'scale-0'}"
										strokeWidth={3.5}
									/>
								</span>

								<span class="min-w-0 flex-1">
									<span class="flex items-start justify-between gap-2">
										<span class="text-fg min-w-0 font-medium break-words capitalize">
											{item.name}
										</span>
										<span
											class="text-fg-subtle mt-0.5 shrink-0 text-xs whitespace-nowrap tabular-nums"
										>
											{item.recipeCount}
											{item.recipeCount === 1 ? 'recipe' : 'recipes'}
										</span>
									</span>

									<span class="text-fg-muted mt-0.5 block text-xs">
										in {item.recipes
											.map((recipe) => recipe.title)
											.join(', ')}{#if item.recipeCount > item.recipes.length}<span
												class="text-fg-subtle"
											>
												+{item.recipeCount - item.recipes.length} more</span
											>{/if}
									</span>
								</span>
							</label>

							<div class="mt-auto flex flex-col gap-2 pt-3">
								{#if item.suggestedAliasOf}
									<!-- The far better fix for a plural. Adding "onions" as its own
									     entry works, but the file then grows a second line for every
									     spelling of everything. -->
									<form method="POST" action="?/assign" use:enhance={submit}>
										<input type="hidden" name="name" value={item.name} />
										<input type="hidden" name="aliasOf" value={item.suggestedAliasOf} />
										<input type="hidden" name="category" value={categories[0] ?? ''} />
										<input type="hidden" name="returnTo" value={returnTo} />
										<Button
											type="submit"
											size="sm"
											variant="soft"
											class="h-auto w-full justify-start py-1.5 text-left whitespace-normal"
											loading={pending?.name === item.name && pending.alias}
											disabled={pending?.name === item.name}
										>
											{#if !(pending?.name === item.name && pending.alias)}
												<SparklesIcon class="size-3.5 shrink-0" />
											{/if}
											<span class="min-w-0">
												Same as <span class="capitalize">{item.suggestedAliasOf}</span>
											</span>
										</Button>
									</form>
								{/if}

								<form method="POST" action="?/assign" use:enhance={submit}>
									<input type="hidden" name="name" value={item.name} />
									<input type="hidden" name="returnTo" value={returnTo} />
									<!-- A native select: this is a real POST form and the Bits UI
									     select does not contribute a form value. The action sits
									     inside the field's trailing edge, matching the pantry's
									     New folder control. -->
									<div class="relative">
										<select
											name="category"
											class="field h-11 w-full appearance-none py-0 pr-30 text-sm capitalize"
											aria-label="Aisle for {item.name}"
										>
											{#each categories as category (category)}
												<option value={category}>{category}</option>
											{/each}
										</select>
										<ChevronDownIcon
											class="text-fg-subtle pointer-events-none absolute top-1/2 right-[6.5rem] size-4 -translate-y-1/2"
											aria-hidden="true"
										/>
										<Button
											type="submit"
											size="sm"
											variant="soft"
											class="absolute top-1/2 right-1.5 -translate-y-1/2"
											loading={pending?.name === item.name && !pending.alias}
											disabled={pending?.name === item.name}
										>
											{#if !(pending?.name === item.name && !pending.alias)}
												<ArrowRightIcon class="size-3.5" />
											{/if}
											Assign
										</Button>
									</div>
								</form>
							</div>
						</article>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<AisleBulkBar
		formId="aisle-bulk-assign"
		action="?/bulkAssign"
		count={selected.size}
		onclear={() => selected.clear()}
		onsubmitted={afterBulkAssign}
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

{#if notice}
	<!-- The confirmation follows the cursor's eye rather than living in one of
	     the tiles, which disappears the moment the update lands. -->
	<div
		class="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6"
		role="status"
		aria-live="polite"
	>
		<div
			class="notice-toast shadow-pop flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium capitalize {notice.tone ===
			'ok'
				? 'bg-ok text-ok-fg'
				: 'bg-danger text-danger-fg'}"
		>
			{#if notice.tone === 'ok'}
				{#key notice.id}
					<span class="relative flex size-4 shrink-0 items-center justify-center">
						<span class="flex" class:success-pop={notice.celebrate}>
							<CheckIcon class="size-4" strokeWidth={3} />
						</span>
						{#if notice.celebrate}
							<span class="pointer-events-none absolute inset-0" aria-hidden="true">
								{#each TOAST_CONFETTI as piece, index (index)}
									<span
										class="confetti-piece"
										style="--dx: {piece.dx}px; --dy: {piece.dy}px; --rot: {piece.rot}deg; --delay: {piece.delay}ms; background-color: {piece.color}"
									></span>
								{/each}
							</span>
						{/if}
					</span>
				{/key}
			{:else}
				<TriangleAlertIcon class="size-4 shrink-0" />
			{/if}
			{notice.message}
		</div>
	</div>
{/if}

<style>
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

	.card-celebrate {
		animation: card-flash 500ms ease-out;
	}

	@keyframes card-flash {
		0% {
			box-shadow: inset 0 0 0 0 transparent;
		}
		30% {
			box-shadow: inset 0 0 0 2px var(--color-ok);
		}
		100% {
			box-shadow: inset 0 0 0 0 transparent;
		}
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

	.notice-toast {
		animation: notice-toast-in 250ms cubic-bezier(0.2, 0.7, 0.3, 1);
	}

	.success-pop {
		animation: success-pop 500ms cubic-bezier(0.2, 0.8, 0.3, 1.4);
		transform-origin: center;
	}

	@keyframes success-pop {
		0% {
			transform: scale(0.2) rotate(-20deg);
			opacity: 0;
		}
		60% {
			transform: scale(1.12) rotate(4deg);
			opacity: 1;
		}
		100% {
			transform: scale(1) rotate(0deg);
			opacity: 1;
		}
	}

	@keyframes notice-toast-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.96);
		}
	}
</style>
