<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { Dialog } from 'bits-ui';
	import { MinusIcon, PlusIcon, ShoppingCartIcon, Trash2Icon, XIcon } from '@lucide/svelte';
	import type { MealPlanDay, ResolvedMealPlanEntry } from '#lib/types/meal-plan.js';
	import Button from '#lib/components/ui/Button.svelte';
	import FieldWithAction from '#lib/components/ui/FieldWithAction.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import { countLabel } from '#lib/utils/pluralize.js';
	import { formatScale, stepScaleDown, stepScaleUp } from '#lib/utils/scale.js';

	/**
	 * The non-drag path: every dish opens this from the week column or the phone
	 * card. It carries the three things a plan entry can do -- scale, move to
	 * another day, remove -- as ordinary forms, so keyboard and touch users are
	 * never blocked by drag-and-drop.
	 *
	 * Bits UI's Dialog supplies the focus trap and Escape handling. On a phone
	 * it is styled as a bottom sheet; on a desktop it is a small centred card.
	 */
	interface Props {
		/** The entry the sheet is open on, if any. */
		day: MealPlanDay | null;
		entry: ResolvedMealPlanEntry | null;
		index: number | null;
		/** Every day in the visible week, for the move picker. */
		days: MealPlanDay[];
		onclose: () => void;
		/** The page owns the toast, so confirmations survive this dialog. */
		ontoast?: (message: string) => void;
	}

	const { day, entry, index, days, onclose, ontoast }: Props = $props();

	const open = $derived(entry !== null && day !== null && index !== null);

	let toDay = $state('');
	const dayDate = $derived(day?.date ?? '');

	const moveOptions = $derived(
		days
			.filter((option) => option.date !== dayDate)
			.map((option) => ({
				value: option.date,
				label: `${option.weekday} ${option.dayNumber} ${option.month}${
					option.isToday ? ' (today)' : ''
				}`
			}))
	);

	// Default to a day that is actually elsewhere. Depend on the options rather
	// than the day object so a scale update does not reset the chosen day.
	$effect(() => {
		if (moveOptions.length === 0) return;
		if (!moveOptions.some((option) => option.value === toDay)) {
			toDay = moveOptions[0].value;
		}
	});

	const servings = $derived(
		entry?.servings != null ? Math.round(entry.servings * entry.scale) : null
	);

	const description = $derived(
		day && entry
			? `${day.weekday} · ${
					servings !== null ? countLabel(servings, 'serving') : `${formatScale(entry.scale)}×`
				}`
			: ''
	);

	const addToShoppingSubmit: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update();
			if (result.type === 'success') {
				ontoast?.(`Shopping list updated with ${entry?.title ?? 'this recipe'}.`);
			}
		};

	const closeAfterSuccess: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update();
			if (result.type === 'success') onclose();
		};
</script>

<Dialog.Root
	{open}
	onOpenChange={(value) => {
		if (!value) onclose();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="bg-overlay anim-fade fixed inset-0 z-40" />

		<Dialog.Content
			class="bg-surface border-border shadow-pop anim-pop fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-xl border sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(calc(100%-2rem),28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
		>
			<header class="border-border flex shrink-0 items-start justify-between gap-3 border-b p-4">
				<div class="min-w-0">
					<Dialog.Title class="text-fg truncate text-base font-semibold">
						{entry?.title ?? 'Dish'}
					</Dialog.Title>
					<Dialog.Description class="text-fg-subtle mt-0.5 text-xs">
						{description}
					</Dialog.Description>
				</div>

				<Dialog.Close>
					{#snippet child({ props })}
						<IconButton {...props} label="Close dish options" size="sm">
							<XIcon class="size-4" />
						</IconButton>
					{/snippet}
				</Dialog.Close>
			</header>

			{#if day && entry && index !== null}
				<div class="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
					<a href="/recipe/{entry.slug}" class="link text-sm">Open recipe</a>

					<section aria-label="Servings">
						<div class="flex items-center justify-between gap-2">
							<div class="min-w-0">
								<p class="text-fg text-sm font-medium">
									{entry.servings !== null ? 'Servings' : 'Scale'}
								</p>
								<p class="text-fg-subtle text-xs">
									{#if servings !== null}
										{countLabel(servings, 'serving')} · {formatScale(entry.scale)}×
									{:else}
										{formatScale(entry.scale)}× the recipe
									{/if}
								</p>
							</div>

							<div
								class="border-border flex shrink-0 items-center gap-1 rounded-md border px-1 py-0.5"
							>
								<form method="POST" action="?/setScale" use:enhance>
									<input type="hidden" name="day" value={day.date} />
									<input type="hidden" name="index" value={index} />
									<input type="hidden" name="scale" value={stepScaleDown(entry.scale)} />
									<IconButton
										type="submit"
										size="sm"
										label="Decrease servings of {entry.title}"
										disabled={entry.scale <= 0.5}
									>
										<MinusIcon class="size-3.5" />
									</IconButton>
								</form>

								<span class="min-w-10 text-center text-sm tabular-nums">
									{formatScale(entry.scale)}×
								</span>

								<form method="POST" action="?/setScale" use:enhance>
									<input type="hidden" name="day" value={day.date} />
									<input type="hidden" name="index" value={index} />
									<input type="hidden" name="scale" value={stepScaleUp(entry.scale)} />
									<IconButton
										type="submit"
										size="sm"
										label="Increase servings of {entry.title}"
										disabled={entry.scale >= 100}
									>
										<PlusIcon class="size-3.5" />
									</IconButton>
								</form>
							</div>
						</div>
					</section>

					<form
						method="POST"
						action="?/move"
						use:enhance={closeAfterSuccess}
						class="border-border border-t pt-4"
					>
						<input type="hidden" name="fromDay" value={day.date} />
						<input type="hidden" name="index" value={index} />

						<p class="text-fg text-sm font-medium">Move to…</p>

						<FieldWithAction chevron="sm" class="mt-2 w-full">
							<select
								name="toDay"
								bind:value={toDay}
								class="field w-full appearance-none bg-none pr-24 text-sm"
								aria-label="Move {entry.title} to day"
							>
								{#each moveOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>

							{#snippet action()}
								<Button
									type="submit"
									size="sm"
									variant="soft"
									class="h-full px-2 text-xs"
									disabled={!toDay}
								>
									Move
								</Button>
							{/snippet}
						</FieldWithAction>
					</form>

					<div class="border-border grid grid-cols-2 gap-2 border-t pt-4">
						<form
							method="POST"
							action="?/addToShopping"
							use:enhance={addToShoppingSubmit}
							class="min-w-0"
						>
							<input type="hidden" name="slug" value={entry.slug} />
							<input type="hidden" name="scale" value={entry.scale} />

							<Button
								type="submit"
								variant="soft"
								size="sm"
								block
								class="px-2 text-xs"
								aria-label="Add {entry.title} to the shopping list"
							>
								<ShoppingCartIcon class="size-4" aria-hidden="true" />
								Shopping list
							</Button>
						</form>

						<form method="POST" action="?/remove" use:enhance={closeAfterSuccess} class="min-w-0">
							<input type="hidden" name="day" value={day.date} />
							<input type="hidden" name="index" value={index} />

							<Button type="submit" variant="dangerSoft" size="sm" block class="px-2 text-xs">
								<Trash2Icon class="size-4" aria-hidden="true" />
								Remove from plan
							</Button>
						</form>
					</div>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
