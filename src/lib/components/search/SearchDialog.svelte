<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { Dialog } from 'bits-ui';
	import {
		CarrotIcon,
		CookingPotIcon,
		RefrigeratorIcon,
		SearchIcon,
		SearchXIcon,
		SignpostIcon,
		XIcon
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import type { SearchResponse } from '$lib/types/search';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import SearchResults from './SearchResults.svelte';
	import { countLabel } from '$lib/utils/pluralize';

	/**
	 * Algolia-style command palette.
	 *
	 * Typing hits `/api/search` on a short debounce; the response is already
	 * grouped and truncated, so this component never needs the whole library.
	 * Results are keyboard-navigable in one flat list even though they are
	 * rendered under group headings, which is what makes the grouping visual
	 * without making the keyboard path confusing.
	 */
	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	const DEBOUNCE_MS = 140;
	const PER_GROUP = 5;

	let query = $state('');
	let response = $state<SearchResponse | null>(null);
	let loading = $state(false);
	let failed = $state(false);
	let activeId = $state<string | null>(null);
	let input = $state<HTMLInputElement | null>(null);

	let controller: AbortController | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	interface QuickLink {
		id: string;
		title: string;
		subtitle: string;
		href: string;
		icon: Component<{ class?: string }>;
	}

	const quickLinks = $derived.by((): QuickLink[] => {
		const counts = response?.counts ?? {
			recipes: 0,
			ingredients: 0,
			aisles: 0,
			pantry: 0
		};

		return [
			{
				id: 'go:recipes',
				title: 'Browse recipes',
				subtitle: countLabel(counts.recipes, 'recipe'),
				href: '/',
				icon: CookingPotIcon
			},
			{
				id: 'go:ingredients',
				title: 'Browse ingredients',
				subtitle: countLabel(counts.ingredients, 'ingredient'),
				href: '/aisles/ingredients',
				icon: CarrotIcon
			},
			{
				id: 'go:aisles',
				title: 'Manage aisles',
				subtitle: countLabel(counts.aisles, 'aisle'),
				href: '/aisles',
				icon: SignpostIcon
			},
			{
				id: 'go:pantry',
				title: 'Browse pantry',
				subtitle: countLabel(counts.pantry, 'item'),
				href: '/pantry',
				icon: RefrigeratorIcon
			}
		];
	});

	const hasQuery = $derived(query.trim().length > 0);

	/** Hit ids in visual order, including the browse shortcuts. */
	const visibleIds = $derived(
		hasQuery
			? (response?.groups.flatMap((group) => group.hits.map((hit) => hit.id)) ?? [])
			: quickLinks.map((link) => link.id)
	);

	const activeIndex = $derived(activeId ? visibleIds.indexOf(activeId) : -1);

	/* Reset when opened, and load the corpus sizes the browse state shows. */
	$effect(() => {
		if (!open) return;

		query = '';
		response = null;
		failed = false;
		activeId = null;

		void runSearch('');
		void tick().then(() => input?.focus());

		return () => {
			controller?.abort();
			if (timer) clearTimeout(timer);
		};
	});

	/* Keep a valid selection as results change under a moving query. */
	$effect(() => {
		const ids = visibleIds;
		if (ids.length === 0) {
			activeId = null;
			return;
		}
		if (!activeId || !ids.includes(activeId)) activeId = ids[0];
	});

	/* Follow the keyboard selection without moving the page behind the dialog. */
	$effect(() => {
		const index = activeIndex;
		if (!open || index < 0) return;

		void tick().then(() => {
			document.getElementById(`search-option-${index}`)?.scrollIntoView({ block: 'nearest' });
		});
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
			// The request may have been superseded while the body was parsing.
			if (controller !== current) return;
			response = body;
		} catch (error) {
			if ((error as Error).name === 'AbortError') return;
			if (controller !== current) return;
			console.error('Search failed:', error);
			failed = true;
			response = null;
		} finally {
			if (controller === current) loading = false;
		}
	}

	function schedule(value: string) {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void runSearch(value), DEBOUNCE_MS);
	}

	function onInput() {
		schedule(query);
	}

	function clear() {
		query = '';
		schedule('');
		input?.focus();
	}

	function move(delta: number) {
		const ids = visibleIds;
		if (ids.length === 0) return;

		const from = activeId ? ids.indexOf(activeId) : -1;
		const next =
			from === -1 ? (delta > 0 ? 0 : ids.length - 1) : (from + delta + ids.length) % ids.length;

		activeId = ids[next];
	}

	function navigate(href: string) {
		open = false;
		void goto(href);
	}

	function activate() {
		if (!activeId) {
			if (hasQuery) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
			return;
		}

		const shortcut = quickLinks.find((link) => link.id === activeId);
		if (shortcut) {
			navigate(shortcut.href);
			return;
		}

		const hit = response?.groups
			.flatMap((group) => group.hits)
			.find((candidate) => candidate.id === activeId);
		if (hit) navigate(hit.href);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			activate();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="bg-overlay anim-fade fixed inset-0 z-40" />

		<Dialog.Content
			class="bg-surface border-border shadow-pop anim-pop fixed top-[8vh] left-1/2 z-50 flex max-h-[min(80dvh,42rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border sm:top-[12vh]"
		>
			<Dialog.Title class="sr-only">Search</Dialog.Title>
			<Dialog.Description class="sr-only">
				Search across recipes, ingredients, aisles and pantry items.
			</Dialog.Description>

			<!-- The input is deliberately borderless: the dialog itself is the field. -->
			<div class="border-border flex items-center gap-2 border-b px-3 py-2.5">
				<SearchIcon class="text-fg-subtle size-4 shrink-0" />

				<input
					bind:this={input}
					bind:value={query}
					oninput={onInput}
					onkeydown={onKeydown}
					type="text"
					role="combobox"
					aria-expanded="true"
					aria-controls="search-results"
					aria-autocomplete="list"
					aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
					aria-label="Search across recipes, ingredients, aisles and pantry items"
					placeholder="Search recipes, ingredients, aisles, pantry…"
					autocomplete="off"
					spellcheck="false"
					class="text-fg placeholder:text-fg-subtle min-w-0 flex-1 border-0 bg-transparent p-0 text-base focus:ring-0 focus:outline-none"
				/>

				{#if loading}
					<Spinner label="Searching" class="shrink-0" />
				{/if}

				{#if query}
					<button
						type="button"
						onclick={clear}
						class="text-fg-subtle hover:text-fg shrink-0 rounded-full p-1 transition-colors"
						aria-label="Clear search"
					>
						<XIcon class="size-4" />
					</button>
				{/if}

				<button
					type="button"
					onclick={() => (open = false)}
					class="text-fg-subtle hover:text-fg border-border bg-surface-muted/60 text-2xs hidden shrink-0 rounded border px-1.5 py-0.5 font-medium transition-colors sm:block"
					aria-label="Close search"
				>
					esc
				</button>
			</div>

			<!--
				One flat scroll region for both the browse shortcuts and the grouped
				hits. Sticky group headers come from SearchResults, so a long list of
				recipes still says what it is while you scroll it.
			-->
			<div
				id="search-results"
				role="listbox"
				aria-label="Search results"
				class="min-h-0 flex-1 overflow-y-auto p-1.5"
			>
				{#if !hasQuery}
					<section role="group" aria-label="Jump to">
						<header
							class="text-fg-muted text-2xs flex items-center gap-2 px-2.5 pt-3 pb-1.5 font-semibold tracking-wider uppercase"
						>
							<span class="text-fg-subtle"><SearchIcon class="size-3.5" /></span>
							<span>Jump to</span>
						</header>

						{#each quickLinks as link, index (link.id)}
							<a
								id={`search-option-${index}`}
								role="option"
								aria-selected={activeId === link.id}
								href={link.href}
								tabindex="-1"
								onmouseenter={() => (activeId = link.id)}
								onclick={() => (open = false)}
								class="group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-100 {activeId ===
								link.id
									? 'bg-accent-soft'
									: 'hover:bg-surface-muted'}"
							>
								<span
									class="border-border bg-surface-muted text-fg-subtle flex size-9 shrink-0 items-center justify-center rounded border"
								>
									<link.icon class="size-4" />
								</span>
								<span class="min-w-0 flex-1">
									<span class="text-fg block truncate text-sm font-medium">{link.title}</span>
									<span class="text-fg-subtle block truncate text-xs">{link.subtitle}</span>
								</span>
							</a>
						{/each}

						<p class="text-fg-subtle px-2.5 py-3 text-xs">
							Type to search across your whole library. Results are grouped by recipes, ingredients,
							aisles and pantry.
						</p>
					</section>
				{:else if failed}
					<div class="text-fg-muted px-4 py-10 text-center text-sm">
						Search is unavailable right now. Try again in a moment.
					</div>
				{:else if loading && !response}
					<div class="flex items-center justify-center gap-2 px-4 py-10 text-sm">
						<Spinner label="Searching" />
						<span class="text-fg-muted">Searching…</span>
					</div>
				{:else if response && response.total === 0}
					<div class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
						<SearchXIcon class="text-fg-subtle size-8" />
						<p class="text-fg text-sm font-medium">No results for “{query.trim()}”</p>
						<p class="text-fg-muted text-xs">
							Try a different spelling, or a single word from the name.
						</p>
					</div>
				{:else if response}
					<SearchResults
						groups={response.groups}
						{query}
						{activeId}
						ids={visibleIds}
						combobox
						onhover={(id) => (activeId = id)}
						onnavigate={() => (open = false)}
					/>
				{/if}
			</div>

			<footer
				class="border-border text-fg-subtle text-2xs flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2"
			>
				<span class="flex items-center gap-1">
					<kbd class="border-border bg-surface-muted rounded border px-1">↑</kbd>
					<kbd class="border-border bg-surface-muted rounded border px-1">↓</kbd>
					to navigate
				</span>
				<span class="flex items-center gap-1">
					<kbd class="border-border bg-surface-muted rounded border px-1">↵</kbd>
					to open
				</span>

				<span class="ml-auto flex items-center gap-3">
					{#if hasQuery && response && response.total > 0}
						<a
							href={`/search?q=${encodeURIComponent(query.trim())}`}
							onclick={() => (open = false)}
							class="text-accent hover:text-accent-hover font-medium"
						>
							See all {response.total}
							{response.total === 1 ? 'result' : 'results'}
						</a>
					{/if}

					{#if response && hasQuery && !loading}
						<span class="tabular-nums">{response.tookMs} ms</span>
					{/if}
				</span>
			</footer>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
