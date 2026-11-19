<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import {
		CalendarDaysIcon,
		ChevronLeftIcon,
		ChevronRightIcon,
		LoaderCircleIcon,
		ShoppingCartIcon,
		XIcon
	} from '@lucide/svelte';
	import type { PageProps } from './$types';
	import type { MealPlanDay, ResolvedMealPlanEntry } from '#lib/types/meal-plan.js';
	import Drawer from '#lib/components/ui/Drawer.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import Page from '#lib/components/ui/Page.svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import DayColumn from '#lib/components/planner/DayColumn.svelte';
	import EntryActionSheet from '#lib/components/planner/EntryActionSheet.svelte';
	import RecipePicker from '#lib/components/planner/RecipePicker.svelte';
	import { countLabel } from '#lib/utils/pluralize.js';

	const { data, form }: PageProps = $props();

	/**
	 * The page is the whole state machine: the week itself lives in the URL and
	 * the file, while the selected phone day, the open sheet and the entry being
	 * edited are view state that should not survive a reload.
	 */
	// Initial value only: the effect below moves it when the URL changes week.
	// Both bounds come from the server, so SSR and hydration choose the same day
	// and today does not flash to Monday before the effect runs.
	let mobileDate = $state(
		untrack(() => (data.today >= data.start && data.today <= data.end ? data.today : data.start))
	);
	let desktopPickerOpen = $state(false);
	let desktopPickerDate = $state<string | null>(null);
	let pickerOpen = $state(false);
	let pickerDate = $state<string | null>(null);
	let actionTarget = $state<{ date: string; index: number } | null>(null);
	let drag = $state<{
		from: { date: string; index: number };
		title: string;
		overDate: string | null;
	} | null>(null);
	let dragAnnouncement = $state('');

	let moveForm = $state<HTMLFormElement | null>(null);
	let moveFrom = $state<{ date: string; index: number } | null>(null);
	let moveToDate = $state<string | null>(null);
	let addingWeek = $state(false);
	let toastMessage = $state<string | null>(null);
	let toastIsError = $state(false);
	let toastNonce = $state(0);

	const WEEK_NAV_CLASS =
		'text-fg-muted hover:bg-surface-muted hover:text-fg inline-flex size-11 items-center justify-center rounded-md transition-colors duration-150 sm:size-9';

	const actionMessage = $derived.by(() => {
		if (!form) return null;
		const result = form as { error?: unknown; message?: unknown };
		if (typeof result.error === 'string') return result.error;
		if (typeof result.message === 'string') return result.message;
		return null;
	});
	const actionIsError = $derived(
		Boolean(form && typeof (form as { error?: unknown }).error === 'string')
	);

	function showToast(message: string, error = false) {
		toastMessage = message;
		toastIsError = error;
		// Remount the toast so a repeated identical message restarts its timer.
		toastNonce += 1;
	}

	// Action results are shown as a toast rather than inline status text. An add
	// or remove returns no message, so it must not clear a picker's toast that
	// arrived at nearly the same time.
	$effect(() => {
		const result = form;
		if (!result || !actionMessage) return;

		// showToast increments toastNonce, which would otherwise make this effect
		// depend on its own write and loop.
		untrack(() => showToast(actionMessage, actionIsError));
	});

	// A new URL means a different week. Land on today when it is visible,
	// otherwise on the Monday, without resetting the chosen day after an add
	// (data.start, data.end and data.today do not change in that case).
	$effect(() => {
		const start = data.start;
		const end = data.end;
		const today = data.today;

		mobileDate = today >= start && today <= end ? today : start;
	});

	const mobileDay = $derived(
		data.days.find((day) => day.date === mobileDate) ?? data.days[0] ?? null
	);

	const actionData = $derived.by(() => {
		if (!actionTarget) return null;

		const day = data.days.find((candidate) => candidate.date === actionTarget?.date);
		if (!day) return null;

		const entry = day.entries[actionTarget.index];
		if (!entry) return null;

		return { day, entry, index: actionTarget.index };
	});

	// Removing or moving the last entry makes the target stale; close rather
	// than showing a sheet about a dish that is no longer there.
	$effect(() => {
		if (actionTarget && !actionData) actionTarget = null;
	});

	const desktopPickerDay = $derived(
		desktopPickerDate ? (data.days.find((day) => day.date === desktopPickerDate) ?? null) : null
	);

	const mobilePickerDay = $derived(
		pickerDate ? (data.days.find((day) => day.date === pickerDate) ?? null) : null
	);

	const pickerTitle = $derived(
		mobilePickerDay ? `Add to ${mobilePickerDay.weekday}` : 'Add a recipe'
	);

	/**
	 * The date strip stays visible while the picker sheet is open. Change the
	 * day and close the sheet rather than leaving it pointed at the previous
	 * day, which would silently add to a day that is no longer on screen.
	 */
	function selectMobileDay(date: string) {
		mobileDate = date;
		if (pickerOpen) pickerOpen = false;
	}

	function openPicker(day: MealPlanDay) {
		// The desktop week is rendered at md and up, where the picker is the
		// right-hand Drawer; phones get the docked bottom sheet.
		const isDesktop =
			typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

		if (isDesktop) {
			desktopPickerDate = day.date;
			desktopPickerOpen = true;
			return;
		}

		pickerDate = day.date;
		pickerOpen = true;
	}

	function openEntry(day: MealPlanDay, index: number) {
		actionTarget = { date: day.date, index };
	}

	function onDragStart(
		event: DragEvent,
		day: MealPlanDay,
		entry: ResolvedMealPlanEntry,
		index: number
	) {
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', `${day.date}|${index}`);
		}

		drag = { from: { date: day.date, index }, title: entry.title, overDate: null };
		dragAnnouncement = `Moving ${entry.title}. Drop on a day, or open the dish for options.`;
	}

	function onDragOver(day: MealPlanDay) {
		if (!drag || drag.overDate === day.date) return;

		drag = { ...drag, overDate: day.date };
		dragAnnouncement = `Drop to move ${drag.title} to ${day.weekday}.`;
	}

	function onDragLeave(day: MealPlanDay) {
		if (!drag || drag.overDate !== day.date) return;
		drag = { ...drag, overDate: null };
	}

	async function onDrop(event: DragEvent, day: MealPlanDay) {
		event.preventDefault();

		const source = drag;
		if (!source) return;

		drag = null;

		if (source.from.date === day.date) {
			dragAnnouncement = `${source.title} stays on ${day.weekday}.`;
			return;
		}

		moveFrom = source.from;
		moveToDate = day.date;
		dragAnnouncement = `Moving ${source.title} to ${day.weekday}.`;

		await tick();
		moveForm?.requestSubmit();
	}

	function onDragEnd() {
		drag = null;
	}

	const moveSubmit: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update();
			moveFrom = null;
			moveToDate = null;

			if (result.type !== 'success') {
				dragAnnouncement = 'That move could not be completed.';
			}
		};

	const addWeekSubmit: SubmitFunction =
		() =>
		async ({ update }) => {
			addingWeek = true;
			try {
				await update();
			} finally {
				addingWeek = false;
			}
		};
</script>

<svelte:head>
	<title>Meal plan</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<!-- The same workbench frame as the recipe list and shopping pages: title
	     bar, a body whose panes scroll, and a status bar. The page never does. -->
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<header
			class="border-border bg-surface flex shrink-0 items-center gap-2 border-b px-3 py-2 md:px-4"
		>
			<div class="min-w-0 flex-1">
				<h1 class="text-fg truncate text-base font-semibold">Meal plan</h1>
				<p class="text-fg-subtle truncate text-xs" title={data.weekLabel}>{data.weekLabel}</p>
			</div>

			<!-- One icon, left of the week navigator, sends the visible week to the
			     shopping list. The accessible name is on the button. -->
			<form method="POST" action="?/addWeek" use:enhance={addWeekSubmit} class="flex shrink-0">
				<input type="hidden" name="start" value={data.start} />
				<IconButton
					type="submit"
					variant="soft"
					label="Add this week to the shopping list"
					class="size-11 shrink-0 p-0 sm:size-9"
					disabled={data.summary.dishes === 0 || addingWeek}
				>
					{#if addingWeek}
						<LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
					{:else}
						<ShoppingCartIcon class="size-4" aria-hidden="true" />
					{/if}
				</IconButton>
			</form>

			<nav class="flex shrink-0 items-center gap-1" aria-label="Week">
				<a
					href="/meal-plan?start={data.previousWeek}"
					class={WEEK_NAV_CLASS}
					aria-label="Previous week"
					title="Previous week"
				>
					<ChevronLeftIcon class="size-5" aria-hidden="true" />
				</a>
				<a
					href="/meal-plan"
					class={WEEK_NAV_CLASS}
					aria-label="This week"
					title="This week"
					aria-current={data.isCurrentWeek ? 'page' : undefined}
				>
					<CalendarDaysIcon class="size-5" aria-hidden="true" />
				</a>
				<a
					href="/meal-plan?start={data.nextWeek}"
					class={WEEK_NAV_CLASS}
					aria-label="Next week"
					title="Next week"
				>
					<ChevronRightIcon class="size-5" aria-hidden="true" />
				</a>
			</nav>
		</header>

		<div class="flex min-h-0 flex-1">
			<div class="flex min-h-0 min-w-0 flex-1 flex-col">
				<!-- Phone day strip: seven equal columns filling the width. -->
				<div class="border-border bg-surface sticky top-0 z-20 shrink-0 border-b md:hidden">
					<div class="grid grid-cols-7 gap-0.5 px-1 py-2">
						{#each data.days as day (day.date)}
							{@const selected = day.date === mobileDate}
							<button
								type="button"
								class="flex min-h-11 w-full min-w-0 flex-col items-center justify-center rounded-md px-1 py-1 transition-colors duration-150 {selected
									? 'bg-accent-soft text-accent-soft-fg'
									: 'text-fg-muted hover:bg-surface-muted hover:text-fg'}"
								aria-pressed={selected}
								aria-current={day.isToday ? 'date' : undefined}
								aria-label={`${day.label}${day.isToday ? ', today' : ''}`}
								onclick={() => selectMobileDay(day.date)}
							>
								<span class="text-2xs font-medium tracking-wider uppercase">
									{day.weekdayShort}
								</span>
								<span class="text-sm font-semibold tabular-nums">{day.dayNumber}</span>
								<span
									class="mt-0.5 size-1 rounded-full {day.isToday ? 'bg-accent' : 'bg-transparent'}"
									aria-hidden="true"
								></span>
							</button>
						{/each}
					</div>
				</div>

				<div class="min-h-0 flex-1 md:overflow-hidden">
					<!-- Desktop and tablet: seven day columns, each an ordered list.
					     At md and lg the pane scrolls sideways rather than shrinking
					     the columns below a readable width. -->
					<div class="hidden h-full min-h-0 md:flex md:flex-col">
						<div class="no-scrollbar min-h-0 flex-1 overflow-auto overscroll-contain p-1.5">
							<div class="grid min-h-full min-w-[48rem] grid-cols-7 gap-1.5">
								{#each data.days as day (day.date)}
									<DayColumn
										{day}
										over={drag?.overDate === day.date}
										onadd={() => openPicker(day)}
										onentry={(entry, index) => openEntry(day, index)}
										ondragstart={(event, entry, index) => onDragStart(event, day, entry, index)}
										ondragend={onDragEnd}
										ondragover={() => onDragOver(day)}
										ondragleave={() => onDragLeave(day)}
										ondrop={(event) => void onDrop(event, day)}
									/>
								{/each}
							</div>
						</div>
					</div>

					<!-- Phone: one day at a time, and the picker as a docked sheet
					     with an inline height transition rather than a new modal
					     system. -->
					<div class="flex h-full min-h-0 flex-col md:hidden">
						<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
							{#if mobileDay}
								<DayColumn
									day={mobileDay}
									variant="phone"
									onadd={() => openPicker(mobileDay)}
									onentry={(entry, index) => openEntry(mobileDay, index)}
								/>
							{/if}
						</div>

						<div
							class="border-border bg-surface-muted/40 flex shrink-0 flex-col overflow-hidden transition-[height] duration-300 ease-out {pickerOpen
								? 'h-[min(65dvh,30rem)] border-t'
								: 'h-0'}"
						>
							{#if pickerOpen}
								<div
									class="border-border bg-surface flex h-12 shrink-0 items-center gap-2 border-b px-3"
								>
									<h2 class="text-fg min-w-0 flex-1 truncate text-sm font-semibold">
										{pickerTitle}
									</h2>
									<IconButton label="Close panel" size="sm" onclick={() => (pickerOpen = false)}>
										<XIcon class="size-4" />
									</IconButton>
								</div>

								<div id="meal-plan-sheet" class="min-h-0 flex-1 overflow-hidden">
									<RecipePicker
										day={mobilePickerDay}
										suggestions={data.suggestions}
										open={pickerOpen}
										ontoast={showToast}
									/>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-3 py-1.5 text-xs sm:px-4"
		>
			<span class="tabular-nums">{countLabel(data.summary.days, 'day')}</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{countLabel(data.summary.recipes, 'recipe')}</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{countLabel(data.summary.servings, 'serving')}</span>

			<span class="ml-auto hidden shrink-0 sm:inline" aria-hidden="true">
				Drag a dish to move it, or open it for options.
			</span>

			<!-- Drag announcements only; action results are announced by their toast. -->
			<span class="sr-only" role="status" aria-live="polite">{dragAnnouncement}</span>
		</footer>
	</div>
</Page>

<Drawer
	bind:open={desktopPickerOpen}
	title={desktopPickerDay ? `Add to ${desktopPickerDay.weekday}` : 'Add a recipe'}
	side="right"
	flush
>
	<RecipePicker
		day={desktopPickerDay}
		suggestions={data.suggestions}
		open={desktopPickerOpen}
		ontoast={showToast}
	/>
</Drawer>

<EntryActionSheet
	day={actionData?.day ?? null}
	entry={actionData?.entry ?? null}
	index={actionData?.index ?? null}
	days={data.days}
	onclose={() => (actionTarget = null)}
	ontoast={showToast}
/>

{#key toastNonce}
	<Toast
		message={toastMessage}
		tone={toastIsError ? 'danger' : 'default'}
		duration={toastIsError ? 6000 : 4000}
		onclose={() => (toastMessage = null)}
	/>
{/key}

<!-- The drag path drives the same move action as the entry sheet. Keeping the
     form in the page means a drop is a normal enhanced submit, and the
     no-JavaScript path is the sheet's Move form rather than drag events. -->
<form
	bind:this={moveForm}
	method="POST"
	action="?/move"
	use:enhance={moveSubmit}
	class="hidden"
	aria-hidden="true"
>
	<input type="hidden" name="fromDay" value={moveFrom?.date ?? ''} />
	<input type="hidden" name="index" value={moveFrom?.index ?? ''} />
	<input type="hidden" name="toDay" value={moveToDate ?? ''} />
</form>
