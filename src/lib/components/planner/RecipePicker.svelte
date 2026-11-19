<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { ChefHatIcon, PlusIcon, SearchIcon, SearchXIcon } from '@lucide/svelte';
	import type { SearchResponse } from '#lib/types/search.js';
	import type { MealPlanDay, MealPlanRecipeOption } from '#lib/types/meal-plan.js';
	import Spinner from '#lib/components/ui/Spinner.svelte';

	/**
	 * Add recipes to one day.
	 *
	 * Typing hits the existing `/api/search` route, which is the same ranking
	 * the command palette uses -- no second index. The suggestions from the
	 * page load are a useful initial list and the no-JavaScript path: every row
	 * is a real add form even though the search box itself needs JavaScript.
	 *
	 * The picker stays open after a pick and confirms each add, so building a
	 * day's menu from a main and a side is one visit rather than two.
	 */
	interface Props {
		day: MealPlanDay | null;
		suggestions: MealPlanRecipeOption[];
		/** Focus the search box whenever the panel opens or retargets. */
		open?: boolean;
		/** Report a successful add to the page, which owns the toast. */
		ontoast?: (message: string) => void;
	}

	const { day, suggestions, open = true, ontoast }: Props = $props();

	const DEBOUNCE_MS = 140;
	const PER_GROUP = 8;

	let query = $state('');
	let response = $state<SearchResponse | null>(null);
	let loading = $state(false);
	let failed = $state(false);

	let timer: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;
	let searchInput = $state<HTMLInputElement | null>(null);
	/** Plain, non-reactive: only used to detect a change of picker target. */
	let lastTarget = '';

	interface PickerItem {
		slug: string;
		title: string;
		meta: string[];
		image: MealPlanRecipeOption['image'];
	}

	const targetLabel = $derived(day ? day.weekday : null);

	const hasQuery = $derived(query.trim().length > 0);

	const items = $derived.by((): PickerItem[] => {
		if (!hasQuery) {
			return suggestions.map((recipe) => ({
				slug: recipe.slug,
				title: recipe.title,
				meta: [
					recipe.timeMinutes ? `${recipe.timeMinutes} min` : '',
					recipe.servings ? `${recipe.servings} servings` : ''
				].filter(Boolean),
				image: recipe.image
			}));
		}

		const hits = response?.groups.find((group) => group.key === 'recipes')?.hits ?? [];

		return hits.flatMap((hit) => {
			// Search hits identify a recipe by id/href rather than a slug field;
			// the href is built as `/recipe/<slug>` by the server.
			if (!hit.href.startsWith('/recipe/')) return [];

			return [
				{
					slug: hit.href.slice('/recipe/'.length),
					title: hit.title,
					meta: hit.meta,
					image: hit.image
				}
			];
		});
	});

	// Reset the panel when it is pointed at a different day, so "Added ..."
	// does not linger against the wrong date.
	$effect(() => {
		const target = day?.date ?? '';
		if (target === lastTarget) return;
		lastTarget = target;

		query = '';
		response = null;
		failed = false;
	});

	// Put the caret in the search field as soon as the panel is on screen.
	$effect(() => {
		if (!open) return;
		void tick().then(() => searchInput?.focus());
	});

	// Abort an in-flight request and pending debounce when the picker unmounts.
	$effect(() => () => {
		controller?.abort();
		if (timer) clearTimeout(timer);
	});

	async function runSearch(value: string) {
		controller?.abort();
		const current = new AbortController();
		controller = current;

		loading = true;
		failed = false;

		try {
			const params = new URLSearchParams({ q: value, limit: String(PER_GROUP) });
			const result = await fetch(`/api/search?${params}`, { signal: current.signal });
			if (!result.ok) throw new Error(`Search failed with ${result.status}`);

			const body = (await result.json()) as SearchResponse;
			if (controller !== current) return;
			response = body;
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			if (controller !== current) return;
			console.error('Recipe search failed:', error);
			failed = true;
			response = null;
		} finally {
			if (controller === current) loading = false;
		}
	}

	function onInput() {
		if (timer) clearTimeout(timer);

		const value = query.trim();
		if (value.length === 0) {
			controller?.abort();
			controller = null;
			loading = false;
			failed = false;
			response = null;
			return;
		}

		timer = setTimeout(() => void runSearch(value), DEBOUNCE_MS);
	}

	/** A per-row submit function, so the confirmation can name the recipe. */
	function addSubmit(title: string): SubmitFunction {
		return () =>
			async ({ update, result }) => {
				await update();
				if (result.type === 'success') {
					ontoast?.(`Added ${title}${targetLabel ? ` to ${targetLabel}` : ''}.`);
				}
			};
	}
</script>

<div class="flex h-full min-h-0 flex-col">
	<div class="border-border shrink-0 border-b p-3">
		<label class="sr-only" for="meal-plan-recipe-search">Search recipes</label>
		<div class="relative">
			<SearchIcon
				class="text-fg-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
				aria-hidden="true"
			/>
			<input
				id="meal-plan-recipe-search"
				bind:this={searchInput}
				bind:value={query}
				oninput={onInput}
				type="search"
				class="field py-2 pr-9 pl-8"
				placeholder="Search recipes…"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if loading}
				<span class="absolute top-1/2 right-2.5 -translate-y-1/2">
					<Spinner label="Searching recipes" />
				</span>
			{/if}
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
		{#if hasQuery && failed}
			<div class="text-fg-muted px-3 py-8 text-center text-sm">
				Search is unavailable right now. The suggestions below are still available.
			</div>
		{:else if hasQuery && loading && !response}
			<div class="flex items-center justify-center gap-2 px-3 py-8 text-sm">
				<Spinner label="Searching recipes" />
				<span class="text-fg-muted">Searching…</span>
			</div>
		{:else if hasQuery && response && items.length === 0}
			<div class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
				<SearchXIcon class="text-fg-subtle size-8" aria-hidden="true" />
				<p class="text-fg text-sm font-medium">No recipes for “{query.trim()}”</p>
				<p class="text-fg-muted text-xs">Try a single word from the recipe name.</p>
			</div>
		{:else}
			<h3 class="text-fg-muted text-2xs px-2 pt-2 pb-1.5 font-semibold tracking-wider uppercase">
				{hasQuery ? 'Recipes' : 'Suggestions'}
			</h3>

			<ul class="flex flex-col gap-1">
				{#each items as item (item.slug)}
					<li>
						<form method="POST" action="?/add" use:enhance={addSubmit(item.title)}>
							<input type="hidden" name="day" value={day?.date ?? ''} />
							<input type="hidden" name="slug" value={item.slug} />
							<input type="hidden" name="scale" value="1" />

							<button
								type="submit"
								class="hover:bg-surface-muted flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
								aria-label={targetLabel
									? `Add ${item.title} to ${targetLabel}`
									: `Add ${item.title}`}
							>
								<span
									class="bg-surface-muted text-fg-subtle flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm"
								>
									{#if item.image}
										<img
											src={item.image.src}
											srcset={item.image.srcset}
											width={item.image.width}
											height={item.image.height}
											alt=""
											loading="lazy"
											decoding="async"
											class="size-full object-cover"
										/>
									{:else}
										<ChefHatIcon class="size-5" aria-hidden="true" />
									{/if}
								</span>

								<span class="min-w-0 flex-1">
									<span class="text-fg block truncate text-sm font-medium">{item.title}</span>
									{#if item.meta.length > 0}
										<span class="text-fg-subtle text-xs">{item.meta.join(' · ')}</span>
									{/if}
								</span>

								<PlusIcon class="text-fg-subtle size-4 shrink-0" aria-hidden="true" />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
