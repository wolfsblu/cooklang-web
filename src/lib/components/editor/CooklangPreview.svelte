<script lang="ts">
	import {
		CarrotIcon,
		ChevronDownIcon,
		ChevronUpIcon,
		CookingPotIcon,
		InfoIcon,
		SoupIcon
	} from '@lucide/svelte';
	import type { RecipePreview } from '$lib/types/editor';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface Props {
		preview: RecipePreview;
		loading?: boolean;
	}

	const { preview, loading = false }: Props = $props();

	type PreviewTabID = 'metadata' | 'ingredients' | 'cookware';

	const recipe = $derived(preview.display);

	const timeLabel = $derived.by(() => {
		const time = recipe.time;
		if (time === undefined || time === null) return null;
		if (typeof time === 'number') return `${time} min`;
		if (time.prep_time || time.cook_time) {
			return [
				time.prep_time ? `${time.prep_time} min prep` : null,
				time.cook_time ? `${time.cook_time} min cook` : null
			]
				.filter(Boolean)
				.join(' · ');
		}
		return null;
	});

	const metadataCount = $derived(
		recipe.tags.length +
			(recipe.servings ? 1 : 0) +
			(timeLabel ? 1 : 0) +
			(recipe.course ? 1 : 0) +
			(recipe.author?.name || recipe.author?.url ? 1 : 0) +
			(recipe.source?.name || recipe.source?.url ? 1 : 0)
	);

	const tabs = $derived([
		...(metadataCount > 0
			? [{ id: 'metadata' as const, label: 'Metadata', icon: InfoIcon, count: metadataCount }]
			: []),
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

	let activeTab = $state<PreviewTabID>('ingredients');
	let detailsOpen = $state(true);

	$effect(() => {
		if (tabs.length === 0) return;
		if (!tabs.some((tab) => tab.id === activeTab)) {
			activeTab = tabs[0].id;
		}
	});

	const hasContent = $derived(
		recipe.ingredients.length > 0 ||
			recipe.cookware.length > 0 ||
			recipe.sections.some((section) => section.content.length > 0)
	);

	function nameOrUrl(value: { name?: string; url?: string } | undefined): string | null {
		if (!value) return null;
		return value.name ?? value.url ?? null;
	}
</script>

<div class="space-y-5 p-4 sm:p-5 {loading ? 'opacity-60' : ''}">
	{#if hasContent}
		{#if recipe.description}
			<p class="text-fg-muted text-sm">{recipe.description}</p>
		{/if}

		{#if tabs.length > 0}
			<div
				class="border-border -mx-4 overflow-hidden border-y sm:-mx-5 {recipe.description
					? ''
					: '-mt-4 sm:-mt-5'}"
			>
				<!--
					A compact tab strip in the same language as the Problems panel:
					tabs select what the panel shows, the chevron collapses it without
					losing the selected tab.
				-->
				<div
					class="bg-surface-muted/40 hover:bg-surface-muted/70 relative flex items-center gap-1 px-1 transition-colors duration-100"
				>
					<!-- The problems bar is one large click target; this invisible
					     layer gives the tab strip the same behaviour without making a
					     button contain the tabs. -->
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
						{#each tabs as tab (tab.id)}
							<button
								type="button"
								role="tab"
								id="preview-tab-{tab.id}"
								aria-selected={activeTab === tab.id}
								aria-controls="preview-details-panel"
								tabindex={activeTab === tab.id ? 0 : -1}
								class="flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium transition-colors duration-100 {activeTab ===
								tab.id
									? 'text-fg'
									: 'text-fg-muted hover:text-fg'} {activeTab === tab.id && detailsOpen
									? 'border-accent'
									: 'border-transparent'}"
								onclick={() => {
									if (activeTab === tab.id) {
										detailsOpen = !detailsOpen;
									} else {
										activeTab = tab.id;
										detailsOpen = true;
									}
								}}
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
						onclick={() => (detailsOpen = !detailsOpen)}
						aria-expanded={detailsOpen}
						aria-controls="preview-details-panel"
						aria-label={detailsOpen ? 'Collapse recipe details' : 'Expand recipe details'}
					>
						{#if detailsOpen}
							<ChevronUpIcon class="size-3.5" />
						{:else}
							<ChevronDownIcon class="size-3.5" />
						{/if}
					</button>
				</div>

				{#if detailsOpen}
					<div
						id="preview-details-panel"
						role="tabpanel"
						aria-labelledby="preview-tab-{activeTab}"
						class="border-border max-h-64 overflow-y-auto border-t p-3"
					>
						{#if activeTab === 'metadata'}
							<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
								{#if recipe.tags.length > 0}
									<dt class="text-fg-muted">Tags</dt>
									<dd class="flex flex-wrap items-center gap-1.5">
										{#each recipe.tags as tag (tag)}
											<Badge>{tag}</Badge>
										{/each}
									</dd>
								{/if}

								{#if recipe.servings}
									<dt class="text-fg-muted">Servings</dt>
									<dd class="text-fg">{recipe.servings}</dd>
								{/if}

								{#if timeLabel}
									<dt class="text-fg-muted">Time</dt>
									<dd class="text-fg">{timeLabel}</dd>
								{/if}

								{#if recipe.course}
									<dt class="text-fg-muted">Course</dt>
									<dd class="text-fg">{recipe.course}</dd>
								{/if}

								{#if nameOrUrl(recipe.author)}
									<dt class="text-fg-muted">Author</dt>
									<dd class="text-fg truncate">{nameOrUrl(recipe.author)}</dd>
								{/if}

								{#if nameOrUrl(recipe.source)}
									<dt class="text-fg-muted">Source</dt>
									<dd class="text-fg truncate">{nameOrUrl(recipe.source)}</dd>
								{/if}
							</dl>
						{:else if activeTab === 'ingredients'}
							<ul class="space-y-1">
								{#each recipe.ingredients as ingredient (ingredient.index)}
									<li class="flex items-baseline justify-between gap-2 text-sm">
										<span>
											{ingredient.name}
											{#if ingredient.note}
												<span class="text-fg-subtle text-xs italic">
													({ingredient.note})
												</span>
											{/if}
										</span>
										{#if ingredient.quantity}
											<span class="text-fg-muted shrink-0 text-xs tabular-nums">
												{ingredient.quantity}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<ul class="space-y-1">
								{#each recipe.cookware as item (item.index)}
									<li class="flex items-baseline justify-between gap-2 text-sm">
										<span>
											{item.name}
											{#if item.note}
												<span class="text-fg-subtle text-xs italic">({item.note})</span>
											{/if}
										</span>
										{#if item.quantity}
											<span class="text-fg-muted shrink-0 text-xs tabular-nums">
												{item.quantity}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<div class="space-y-5">
			{#each recipe.sections as section, sectionIndex (sectionIndex)}
				{#if section.name}
					<h3 class="text-fg mb-2 text-base font-semibold">{section.name}</h3>
				{:else if recipe.sections.length > 1}
					<h3 class="text-fg mb-2 text-base font-semibold">Section {sectionIndex + 1}</h3>
				{/if}

				{#each section.content as content, contentIndex (contentIndex)}
					{#if content.type === 'text'}
						<p class="text-fg-muted text-sm italic">{content.value}</p>
					{:else}
						<div class="flex gap-3">
							<span class="text-fg-subtle min-w-5 text-sm font-semibold tabular-nums">
								{content.number}.
							</span>
							<p class="min-w-0 flex-1 text-sm">
								{#each content.items as item, itemIndex (itemIndex)}
									{#if item.type === 'text'}
										{item.value}
									{:else if item.type === 'ingredient'}
										<span class="bg-accent-soft text-accent-soft-fg rounded-sm px-1 font-medium">
											{item.name}
											{#if item.quantity}<span class="font-normal"> ({item.quantity})</span>{/if}
										</span>
									{:else if item.type === 'cookware'}
										<span class="bg-accent2-soft text-accent2-soft-fg rounded-sm px-1 font-medium">
											{item.name}
											{#if item.quantity}<span class="font-normal"> ({item.quantity})</span>{/if}
										</span>
									{:else if item.type === 'timer'}
										<span class="bg-warn-soft text-warn-soft-fg rounded-sm px-1">
											{#if item.name}<span class="font-medium">{item.name}:</span>{/if}
											{item.quantity}
										</span>
									{:else if item.type === 'inlineQuantity'}
										<span class="text-fg-subtle italic">({item.quantity})</span>
									{/if}
								{/each}
							</p>
						</div>
					{/if}
				{/each}
			{/each}
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
			<SoupIcon class="text-fg-subtle size-8" />
			<p class="text-fg text-sm font-medium">Nothing to preview yet</p>
			<p class="text-fg-subtle max-w-xs text-sm">
				Write a step with an <code>@ingredient&#123;&#125;</code>, a
				<code>#pan&#123;&#125;</code> or a <code>~timer&#123;&#125;</code> and it will show up here.
			</p>
		</div>
	{/if}
</div>
