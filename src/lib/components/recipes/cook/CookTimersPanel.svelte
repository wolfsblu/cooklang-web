<script lang="ts">
	import {
		ChevronDownIcon,
		ChevronUpIcon,
		PlusIcon,
		TimerIcon,
		Volume2Icon,
		VolumeXIcon
	} from '@lucide/svelte';
	import type { ActiveTimer } from '$lib/types/recipe';
	import { countLabel } from '$lib/utils/pluralize';
	import Button from '$lib/components/ui/Button.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import TimerCard from './TimerCard.svelte';

	/**
	 * The docked timers panel, modelled on the editor's problems console rather
	 * than a drawer. It shares the workbench frame, pushes the step pane up
	 * instead of covering it, and is deliberately not modal: cooking carries on
	 * behind it and focus is never trapped.
	 *
	 * Once it is on screen it only collapses: the header strip always remains,
	 * so a running timer can never be hidden by accident. The whole strip is a
	 * click target, with the explicit toggle at its far right.
	 */
	interface Props {
		timers: ActiveTimer[];
		audioEnabled: boolean;
		expanded: boolean;
		ontoggleexpanded: () => void;
		ontoggleaudio: () => void;
		onaddtimer: (name: string, totalSeconds: number) => void;
		onpause: (id: string) => void;
		onresume: (id: string) => void;
		oncancel: (id: string) => void;
	}

	const {
		timers,
		audioEnabled,
		expanded,
		ontoggleexpanded,
		ontoggleaudio,
		onaddtimer,
		onpause,
		onresume,
		oncancel
	}: Props = $props();

	// Custom timers are created here rather than in a dialog: the panel is
	// already the timer workspace, and a form in place keeps the step visible.
	let adding = $state(false);
	let name = $state('');
	let minutes = $state(5);
	let seconds = $state(0);
	let nameInput = $state<HTMLInputElement | null>(null);

	const totalSeconds = $derived(
		Math.max(0, Number(minutes) || 0) * 60 + Math.max(0, Number(seconds) || 0)
	);

	$effect(() => {
		if (adding) nameInput?.focus();
	});

	function toggleForm() {
		// The plus button is visible even while collapsed; opening the form
		// should reveal the panel rather than hide it.
		if (!expanded) {
			ontoggleexpanded();
			adding = true;
			return;
		}

		adding = !adding;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (totalSeconds <= 0) return;

		onaddtimer(name.trim(), totalSeconds);
		name = '';
		minutes = 5;
		seconds = 0;
		adding = false;
	}

	function handleFormKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;

		// Closing the form is more local than collapsing the panel or leaving
		// cook mode, so this stops before the window-level shortcut sees it.
		event.preventDefault();
		event.stopPropagation();
		adding = false;
	}
</script>

<div class="border-border bg-surface shrink-0 border-t" role="region" aria-label="Active timers">
	<div class="relative flex min-w-0 items-center gap-1 px-2 py-1">
		<!-- The whole strip toggles; the action buttons sit above it. -->
		<button
			type="button"
			tabindex="-1"
			aria-hidden="true"
			class="absolute inset-0 z-0 cursor-pointer"
			onclick={ontoggleexpanded}
		></button>

		<div class="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
			<TimerIcon class="text-warn-soft-fg size-3.5 shrink-0" />
			<span class="text-fg text-xs font-medium">Timers</span>
			<span class="text-fg-subtle text-xs tabular-nums">({timers.length})</span>
			<span class="text-fg-subtle hidden truncate text-xs sm:inline">
				· {countLabel(timers.length, 'active timer')}
			</span>
		</div>

		<IconButton
			size="sm"
			class="relative z-10"
			variant="toolbar"
			label={adding ? 'Close custom timer form' : 'Add custom timer'}
			aria-expanded={adding}
			aria-controls="cook-timer-form"
			onclick={toggleForm}
		>
			<PlusIcon class="size-4" />
		</IconButton>

		<IconButton
			size="sm"
			class="relative z-10"
			variant="toolbar"
			label={audioEnabled ? 'Mute timer alerts' : 'Unmute timer alerts'}
			onclick={ontoggleaudio}
		>
			{#if audioEnabled}
				<Volume2Icon class="size-4" />
			{:else}
				<VolumeXIcon class="size-4" />
			{/if}
		</IconButton>

		<IconButton
			size="sm"
			class="relative z-10"
			variant="toolbar"
			label={expanded ? 'Collapse timers' : 'Expand timers'}
			aria-expanded={expanded}
			aria-controls="cook-timers-panel"
			onclick={ontoggleexpanded}
		>
			{#if expanded}
				<ChevronDownIcon class="size-4" />
			{:else}
				<ChevronUpIcon class="size-4" />
			{/if}
		</IconButton>
	</div>

	<div
		id="cook-timers-panel"
		class="border-border max-h-44 overflow-y-auto overscroll-y-contain border-t sm:max-h-52"
		hidden={!expanded}
	>
		{#if adding}
			<!-- The form's own Escape handler closes it before the window shortcut. -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<form
				id="cook-timer-form"
				class="border-border bg-surface-muted/30 flex flex-wrap items-end gap-2 border-b p-2"
				aria-label="Add custom timer"
				onsubmit={submit}
				onkeydown={handleFormKeydown}
			>
				<label class="min-w-0 flex-1 basis-36">
					<span class="text-fg-subtle text-2xs mb-1 block font-medium">Name</span>
					<input
						bind:this={nameInput}
						bind:value={name}
						type="text"
						maxlength="80"
						placeholder="e.g. Pasta"
						class="field h-8 w-full py-0 text-sm"
					/>
				</label>

				<label class="w-20">
					<span class="text-fg-subtle text-2xs mb-1 block font-medium">Minutes</span>
					<input
						bind:value={minutes}
						type="number"
						min="0"
						max="999"
						step="1"
						inputmode="numeric"
						class="field h-8 w-full py-0 text-center text-sm tabular-nums"
					/>
				</label>

				<label class="w-20">
					<span class="text-fg-subtle text-2xs mb-1 block font-medium">Seconds</span>
					<input
						bind:value={seconds}
						type="number"
						min="0"
						max="59"
						step="1"
						inputmode="numeric"
						class="field h-8 w-full py-0 text-center text-sm tabular-nums"
					/>
				</label>

				<div class="flex items-center gap-1">
					<Button type="submit" size="sm" disabled={totalSeconds <= 0}>Start</Button>
					<Button type="button" size="sm" variant="ghost" onclick={() => (adding = false)}>
						Cancel
					</Button>
				</div>
			</form>
		{/if}

		<div class="p-2">
			{#if timers.length === 0}
				<p class="text-fg-subtle flex items-center justify-center gap-2 px-3 py-4 text-xs">
					<TimerIcon class="size-4 shrink-0" />
					No active timers. Tap a timer in a step, or add one above.
				</p>
			{:else}
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(15rem,18rem))]">
					{#each timers as timer (timer.id)}
						<TimerCard {timer} {onpause} {onresume} {oncancel} />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
