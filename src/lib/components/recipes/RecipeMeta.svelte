<script lang="ts">
	import {
		ClockIcon,
		ExternalLinkIcon,
		FlameIcon,
		SoupIcon,
		TimerIcon,
		UserIcon
	} from '@lucide/svelte';
	import type { RecipeDisplay } from '$lib/types/recipe';
	import Badge from '$lib/components/ui/Badge.svelte';
	import ServingsControl from './ServingsControl.svelte';

	/**
	 * The recipe's frontmatter, as one pane of the workbench sidebar.
	 *
	 * This used to be a single line of muted text under the title, where the
	 * values ran together and it was not obvious which number was which.
	 */
	interface Props {
		recipe: RecipeDisplay;
		/** What the file declares, unscaled. `recipe.servings` has the scale in it. */
		baseServings: number | null;
		scale: number;
		onscale: (newScale: number) => void;
		/**
		 * Cook mode already shows the tags in RecipeHeader, so it asks for the
		 * pane without them rather than repeating the row.
		 */
		showTags?: boolean;
	}

	const { recipe, baseServings, scale, onscale, showTags = true }: Props = $props();

	function minutes(value: number): string {
		if (value < 60) return `${value} min`;

		const hours = Math.floor(value / 60);
		const rest = value % 60;
		return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
	}

	/** Cooklang gives either a single total or a prep/cook pair. */
	const times = $derived.by(() => {
		const time = recipe.time;
		if (!time) return [];

		if (typeof time === 'number') {
			return time > 0 ? [{ icon: ClockIcon, label: 'Time', value: minutes(time) }] : [];
		}

		const rows = [];
		if (time.prep_time)
			rows.push({ icon: TimerIcon, label: 'Prep', value: minutes(time.prep_time) });
		if (time.cook_time)
			rows.push({ icon: FlameIcon, label: 'Cook', value: minutes(time.cook_time) });

		// Only worth a total when it is not just one of the two repeated.
		if (time.prep_time && time.cook_time) {
			rows.push({
				icon: ClockIcon,
				label: 'Total',
				value: minutes(time.prep_time + time.cook_time)
			});
		}

		return rows;
	});

	/**
	 * A source with a URL but no name is common. "Link" says nothing, so fall
	 * back to the host, which at least tells you where it came from.
	 */
	const sourceLabel = $derived.by(() => {
		if (recipe.source?.name) return recipe.source.name;
		if (!recipe.source?.url) return null;

		try {
			return new URL(recipe.source.url).hostname.replace(/^www\./, '');
		} catch {
			return 'Source';
		}
	});

	// No `hasAnything` guard: the servings control is always worth showing, so the
	// pane always has content. Dropping the guard is also what keeps scaling
	// reachable on a recipe whose frontmatter says nothing at all.
</script>

{#snippet values()}
	<dl class="divide-border divide-y px-4 py-3 text-sm">
		<ServingsControl {baseServings} {scale} {onscale} />

		{#each times as row (row.label)}
			<div class="flex items-center justify-between gap-3 py-1.5 first:pt-0">
				<dt class="text-fg-muted flex items-center gap-2">
					<row.icon class="size-4 shrink-0" />
					{row.label}
				</dt>
				<dd class="text-fg font-medium tabular-nums">{row.value}</dd>
			</div>
		{/each}

		{#if recipe.course}
			<div class="flex items-center justify-between gap-3 py-1.5 first:pt-0">
				<dt class="text-fg-muted flex items-center gap-2">
					<SoupIcon class="size-4 shrink-0" />
					Course
				</dt>
				<dd class="text-fg font-medium capitalize">{recipe.course}</dd>
			</div>
		{/if}

		{#if recipe.author?.name}
			<div class="flex items-center justify-between gap-3 py-1.5 first:pt-0">
				<dt class="text-fg-muted flex items-center gap-2">
					<UserIcon class="size-4 shrink-0" />
					Author
				</dt>
				<dd class="min-w-0 truncate text-right font-medium">
					{#if recipe.author.url}
						<a href={recipe.author.url} class="link" target="_blank" rel="noopener noreferrer"
							>{recipe.author.name}</a
						>
					{:else}
						<span class="text-fg">{recipe.author.name}</span>
					{/if}
				</dd>
			</div>
		{/if}

		{#if sourceLabel}
			<div class="flex items-center justify-between gap-3 py-1.5 first:pt-0">
				<dt class="text-fg-muted flex items-center gap-2">
					<ExternalLinkIcon class="size-4 shrink-0" />
					Source
				</dt>
				<dd class="min-w-0 truncate text-right font-medium">
					{#if recipe.source?.url}
						<a href={recipe.source.url} class="link" target="_blank" rel="noopener noreferrer"
							>{sourceLabel}</a
						>
					{:else}
						<span class="text-fg">{sourceLabel}</span>
					{/if}
				</dd>
			</div>
		{/if}

		{#if showTags && recipe.tags.length > 0}
			<div class="py-1.5">
				<dt class="sr-only">Tags</dt>
				<dd class="flex min-w-0 flex-wrap gap-1">
					{#each recipe.tags as tag (tag)}
						<Badge>{tag}</Badge>
					{/each}
				</dd>
			</div>
		{/if}
	</dl>
{/snippet}

<section class="border-border border-b last:border-b-0">
	{@render values()}
</section>
