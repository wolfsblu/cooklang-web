<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ArrowRightIcon,
		CarrotIcon,
		CookingPotIcon,
		RefrigeratorIcon,
		SearchIcon,
		SearchXIcon,
		SignpostIcon
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import type { PageProps } from './$types';
	import SearchResults from '$lib/components/search/SearchResults.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Page from '$lib/components/ui/Page.svelte';
	import { countLabel } from '$lib/utils/pluralize';

	const { data }: PageProps = $props();

	// The initial value is the URL's query, which is what makes the first
	// server render match a shared link. The effect below keeps it in step with
	// back/forward and links from the overlay.
	// svelte-ignore state_referenced_locally
	let search = $state(data.query);
	let timer: ReturnType<typeof setTimeout> | null = null;

	const hasQuery = $derived(data.query.length > 0);

	// Follow back/forward and the overlay's "see all" link without clobbering
	// what is being typed.
	$effect(() => {
		const fromUrl = data.query;
		if (document.activeElement?.tagName !== 'INPUT' && search !== fromUrl) {
			search = fromUrl;
		}
	});

	function go(value: string) {
		const query = value.trim();
		void goto(query ? `/search?q=${encodeURIComponent(query)}` : '/search', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function onInput() {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => go(search), 250);
	}

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (timer) clearTimeout(timer);
		go(search);
	}

	const browse = $derived.by(
		(): {
			label: string;
			href: string;
			icon: Component<{ class?: string }>;
			count: number;
			noun: string;
		}[] => [
			{
				label: 'Recipes',
				href: '/',
				icon: CookingPotIcon,
				count: data.counts.recipes,
				noun: 'recipe'
			},
			{
				label: 'Ingredients',
				href: '/aisles/ingredients',
				icon: CarrotIcon,
				count: data.counts.ingredients,
				noun: 'ingredient'
			},
			{
				label: 'Aisles',
				href: '/aisles',
				icon: SignpostIcon,
				count: data.counts.aisles,
				noun: 'aisle'
			},
			{
				label: 'Pantry',
				href: '/pantry',
				icon: RefrigeratorIcon,
				count: data.counts.pantry,
				noun: 'item'
			}
		]
	);

	const groupSummary = $derived(
		data.groups.map((group) => `${group.total} ${group.label.toLowerCase()}`).join(' · ')
	);
</script>

<svelte:head>
	<title>{hasQuery ? `${data.query} · Search` : 'Search'}</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<header class="border-border flex shrink-0 flex-col gap-2 border-b px-3 py-3 sm:px-4">
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h1 class="text-fg text-base font-semibold">Search</h1>
				<p class="text-fg-subtle text-xs">
					{#if hasQuery}
						<span class="tabular-nums">{countLabel(data.total, 'result')}</span>
						for “<span class="text-fg-muted">{data.query}</span>”
					{:else}
						Recipes, ingredients, aisles and pantry, in one place.
					{/if}
				</p>
			</div>

			<form method="GET" action="/search" onsubmit={onSubmit} class="relative max-w-xl">
				<SearchIcon
					class="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
				/>
				<input
					bind:value={search}
					oninput={onInput}
					type="search"
					name="q"
					placeholder="Search recipes, ingredients, aisles, pantry…"
					aria-label="Search across recipes, ingredients, aisles and pantry items"
					autocomplete="off"
					class="field pr-9 pl-9"
				/>
			</form>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if !hasQuery}
				<div class="mx-auto w-full max-w-3xl p-4 sm:p-6">
					<h2 class="text-fg text-sm font-semibold">Browse everything</h2>
					<p class="text-fg-muted mt-1 text-sm">
						Start typing above, or open search from anywhere with
						<kbd class="border-border bg-surface-muted rounded border px-1 py-0.5 text-xs">Ctrl</kbd
						>
						+
						<kbd class="border-border bg-surface-muted rounded border px-1 py-0.5 text-xs">K</kbd>.
					</p>

					<div class="mt-4 grid gap-3 sm:grid-cols-2">
						{#each browse as item (item.href)}
							<a
								href={item.href}
								class="border-border bg-surface hover:border-border-strong group flex items-center gap-3 rounded-lg border p-4 transition-colors"
							>
								<span
									class="bg-accent-soft text-accent-soft-fg flex size-10 shrink-0 items-center justify-center rounded-md"
								>
									<item.icon class="size-5" />
								</span>
								<span class="min-w-0 flex-1">
									<span class="text-fg block text-sm font-medium">{item.label}</span>
									<span class="text-fg-subtle block text-xs tabular-nums">
										{countLabel(item.count, item.noun)}
									</span>
								</span>
								<ArrowRightIcon
									class="text-fg-subtle group-hover:text-fg size-4 shrink-0 transition-colors"
								/>
							</a>
						{/each}
					</div>
				</div>
			{:else if data.total === 0}
				<EmptyState
					icon={SearchXIcon}
					title="No results for “{data.query}”"
					description="Try a different spelling, a single word from the name, or browse the categories above."
				>
					{#snippet actions()}
						<a href="/search" class="link text-sm">Clear search</a>
					{/snippet}
				</EmptyState>
			{:else}
				<div class="mx-auto w-full max-w-3xl px-2 py-2 sm:px-3">
					<SearchResults groups={data.groups} query={data.query} />
				</div>
			{/if}
		</div>

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-1.5 text-xs"
		>
			{#if hasQuery}
				<span class="tabular-nums">{countLabel(data.total, 'result')}</span>
				{#if groupSummary}
					<span class="text-border" aria-hidden="true">·</span>
					<span class="min-w-0 truncate">{groupSummary}</span>
				{/if}
				<span class="ml-auto tabular-nums">{data.tookMs} ms</span>
			{:else}
				<span class="tabular-nums">
					{countLabel(data.counts.recipes, 'recipe')} indexed
				</span>
				<span class="ml-auto">Search as you type</span>
			{/if}
		</footer>
	</div>
</Page>
