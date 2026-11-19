<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	/**
	 * One day of the week: a single ordered list of dishes.
	 *
	 * Two densities, the compact week-grid column and the full-width phone
	 * card. Both use the same border, radius and surface roles as the recipe
	 * list, so the planner reads as part of the same workbench.
	 */
	export const dayColumn = tv({
		base: 'flex min-h-0 flex-col border-border bg-surface transition-colors duration-150',
		variants: {
			variant: {
				grid: 'gap-2 rounded-lg border p-2',
				phone: 'gap-3 rounded-lg border p-3'
			},
			empty: {
				true: 'border-dashed bg-surface-muted/30'
			},
			// After `empty`, so today's whole-column highlight survives an empty
			// day; `over` comes last and wins while a drag is hovering.
			today: {
				true: 'border-accent bg-accent-soft/30 ring-1 ring-accent'
			},
			over: {
				true: 'border-accent bg-accent-soft ring-2 ring-accent'
			}
		},
		defaultVariants: { variant: 'grid', empty: false, today: false, over: false }
	});

	export const dayEntry = tv({
		base: 'flex w-full min-w-0 items-center gap-1.5 rounded-sm bg-surface text-left transition-colors duration-150 hover:bg-surface-muted',
		variants: {
			variant: {
				grid: 'p-1',
				phone: 'min-h-12 p-2'
			}
		},
		defaultVariants: { variant: 'grid' }
	});

	export const dayClearButton = tv({
		base: 'flex w-full items-center justify-center gap-1.5 rounded-sm text-danger-soft-fg transition-colors duration-150 hover:bg-danger-soft',
		variants: {
			variant: {
				grid: 'min-h-8 text-xs',
				phone: 'min-h-11 text-sm'
			}
		},
		defaultVariants: { variant: 'grid' }
	});

	export const dayAddButton = tv({
		base: 'flex w-full items-center justify-center gap-1.5 rounded-sm border border-dashed border-border text-fg-subtle transition-colors duration-150 hover:border-accent hover:bg-surface-muted hover:text-fg',
		variants: {
			variant: {
				grid: 'min-h-9 text-xs',
				phone: 'min-h-14 text-sm'
			}
		},
		defaultVariants: { variant: 'grid' }
	});

	export type DayColumnVariant = VariantProps<typeof dayColumn>['variant'];
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChefHatIcon, ClockIcon, PlusIcon, Trash2Icon } from '@lucide/svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import type { MealPlanDay, ResolvedMealPlanEntry } from '#lib/types/meal-plan.js';
	import { countLabel } from '#lib/utils/pluralize.js';
	import { formatScale } from '#lib/utils/scale.js';

	interface Props {
		day: MealPlanDay;
		variant?: DayColumnVariant;
		/** True while a drag is hovering this day. */
		over?: boolean;
		onadd?: () => void;
		onentry?: (entry: ResolvedMealPlanEntry, index: number) => void;
		ondragstart?: (event: DragEvent, entry: ResolvedMealPlanEntry, index: number) => void;
		ondragend?: () => void;
		ondragover?: (event: DragEvent) => void;
		ondragleave?: () => void;
		ondrop?: (event: DragEvent) => void;
	}

	const {
		day,
		variant = 'grid',
		over = false,
		onadd,
		onentry,
		ondragstart,
		ondragend,
		ondragover,
		ondragleave,
		ondrop
	}: Props = $props();

	const entries = $derived(day.entries);
	let confirmingClear = $state(false);
	let clearForm = $state<HTMLFormElement | null>(null);

	/**
	 * "Monday, empty" or "Monday: Pancakes, 4 servings". It is the section's
	 * name, so the dishes below are heard in context rather than as a bare list.
	 */
	const dayAriaLabel = $derived(
		entries.length === 0
			? `${day.weekday}, empty`
			: `${day.weekday}: ${entries.map(describeEntry).join('; ')}`
	);

	function describeEntry(entry: ResolvedMealPlanEntry): string {
		if (entry.servings !== null) {
			return `${entry.title}, ${countLabel(Math.round(entry.servings * entry.scale), 'serving')}`;
		}

		return `${entry.title}, ${formatScale(entry.scale)}×`;
	}

	function handleDragOver(event: DragEvent) {
		if (!ondrop) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		ondragover?.(event);
	}

	function handleDragLeave(event: DragEvent) {
		// Moving between the column and its children fires dragleave on the
		// column; only clear the highlight when the pointer really leaves it.
		const next = event.relatedTarget;
		if (
			next instanceof Node &&
			event.currentTarget instanceof Node &&
			event.currentTarget.contains(next)
		) {
			return;
		}

		ondragleave?.();
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		ondrop?.(event);
	}
</script>

<section
	class={dayColumn({
		variant,
		// An empty today column uses the solid today treatment instead of the
		// dashed empty outline, so the whole-column highlight reads as selection.
		empty: entries.length === 0 && !day.isToday,
		today: day.isToday,
		over
	})}
	aria-label={dayAriaLabel}
	aria-current={day.isToday ? 'date' : undefined}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<header class="flex min-w-0 items-start justify-between gap-1">
		<div class="min-w-0">
			<h2
				class="flex min-w-0 items-baseline gap-x-1 whitespace-nowrap {variant === 'grid'
					? 'text-xs'
					: 'text-base'} font-semibold {day.isToday ? 'text-accent' : 'text-fg'}"
				aria-label={day.label}
			>
				<span>{day.weekdayShort}</span>
				<span class="text-fg-subtle text-2xs font-normal tabular-nums">
					{day.dayNumber}
					{day.month}
				</span>
			</h2>
		</div>
	</header>

	{#if entries.length > 0}
		<ul class="flex min-h-0 flex-col gap-1">
			{#each entries as entry, index (`${index}:${entry.slug}`)}
				<li class="min-w-0">
					<button
						type="button"
						class={dayEntry({
							variant,
							class: ondragstart ? 'cursor-grab active:cursor-grabbing' : ''
						})}
						draggable={ondragstart ? true : undefined}
						onclick={() => onentry?.(entry, index)}
						ondragstart={(event) => ondragstart?.(event, entry, index)}
						ondragend={() => ondragend?.()}
					>
						<span
							class="bg-surface-muted text-fg-subtle flex shrink-0 items-center justify-center overflow-hidden rounded-sm {variant ===
							'grid'
								? 'size-7'
								: 'size-10'}"
						>
							{#if entry.image}
								<img
									src={entry.image.src}
									srcset={entry.image.srcset}
									width={entry.image.width}
									height={entry.image.height}
									alt=""
									loading="lazy"
									decoding="async"
									class="size-full object-cover"
								/>
							{:else}
								<ChefHatIcon
									class={variant === 'grid' ? 'size-3.5' : 'size-5'}
									aria-hidden="true"
								/>
							{/if}
						</span>

						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-fg block truncate text-xs font-medium">{entry.title}</span>
							<span
								class="text-fg-subtle text-2xs flex flex-wrap items-center gap-x-1 tabular-nums"
							>
								<span>{formatScale(entry.scale)}×</span>
								{#if entry.timeMinutes !== null}
									<span class="inline-flex items-center gap-0.5">
										<ClockIcon class="size-2.5" aria-hidden="true" />
										{entry.timeMinutes} min
									</span>
								{/if}
								{#if variant === 'phone' && entry.servings !== null}
									<span class="text-border" aria-hidden="true">·</span>
									<span>{countLabel(Math.round(entry.servings * entry.scale), 'serving')}</span>
								{/if}
							</span>
							<span class="sr-only">. Change servings, move or remove.</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if onadd}
		<button
			type="button"
			class={dayAddButton({ variant, class: entries.length === 0 ? 'flex-1' : '' })}
			aria-label={entries.length === 0 ? dayAriaLabel : `Add recipe to ${day.weekday}`}
			onclick={onadd}
		>
			<PlusIcon class={variant === 'grid' ? 'size-3.5' : 'size-5'} aria-hidden="true" />
			<span>{variant === 'phone' ? 'Add recipe' : 'Add'}</span>
		</button>

		{#if entries.length > 0}
			<form method="POST" action="?/clearDay" use:enhance bind:this={clearForm} class="shrink-0">
				<input type="hidden" name="day" value={day.date} />
				<button
					type="button"
					class={dayClearButton({ variant })}
					aria-label="Clear all dishes from {day.weekday}"
					onclick={() => (confirmingClear = true)}
				>
					<Trash2Icon class={variant === 'grid' ? 'size-3.5' : 'size-4'} aria-hidden="true" />
					<span>{variant === 'phone' ? 'Clear day' : 'Clear'}</span>
				</button>
			</form>

			<ConfirmDialog
				bind:open={confirmingClear}
				title="Clear {day.weekday}?"
				description="Remove all {countLabel(
					entries.length,
					'dish',
					'dishes'
				)} from {day.weekday}? This cannot be undone."
				confirmLabel="Clear day"
				destructive
				onconfirm={() => clearForm?.requestSubmit()}
			/>
		{/if}
	{/if}
</section>
