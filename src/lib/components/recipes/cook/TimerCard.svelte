<script lang="ts">
	import { PauseIcon, PlayIcon, XIcon } from '@lucide/svelte';
	import type { ActiveTimer } from '$lib/types/recipe';
	import { formatTimeRemaining } from '$lib/utils/timer';
	import Card from '$lib/components/ui/Card.svelte';
	import TimerCircleProgress from './TimerCircleProgress.svelte';

	interface Props {
		timer: ActiveTimer;
		onpause: (id: string) => void;
		onresume: (id: string) => void;
		oncancel: (id: string) => void;
	}

	const { timer, onpause, onresume, oncancel }: Props = $props();

	const progress = $derived(
		timer.totalSeconds > 0 ? (timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds : 0
	);
	const isComplete = $derived(timer.remainingSeconds <= 0);
	const isPaused = $derived(timer.status === 'paused');
</script>

<Card
	variant="outline"
	class="overflow-hidden p-0 {isComplete
		? 'bg-warn-soft text-warn-soft-fg border-warn animate-pulse'
		: ''}"
>
	<div class="flex items-stretch">
		<div class="flex min-w-0 flex-1 items-center gap-3 p-3">
			<TimerCircleProgress {progress} complete={isComplete} />

			<div class="min-w-0 flex-1">
				<p class="truncate font-medium">{timer.name}</p>
				<p class="text-2xl tabular-nums" aria-live={isComplete ? 'assertive' : 'off'}>
					{formatTimeRemaining(timer.remainingSeconds)}
				</p>
				{#if timer.stepNumber > 0}
					<p class="text-fg-subtle text-xs">Step {timer.stepNumber}</p>
				{:else}
					<p class="text-fg-subtle text-xs">Custom timer</p>
				{/if}
			</div>
		</div>

		<!-- The actions are flush with the card edge, not inset on a padded panel. -->
		<div class="border-border flex shrink-0 flex-col border-l">
			{#if !isComplete}
				<button
					type="button"
					class="text-fg-muted hover:bg-surface-muted hover:text-fg flex min-h-9 flex-1 items-center justify-center px-3 transition-colors duration-100"
					aria-label={isPaused ? `Resume ${timer.name}` : `Pause ${timer.name}`}
					onclick={() => (isPaused ? onresume(timer.id) : onpause(timer.id))}
				>
					{#if isPaused}
						<PlayIcon class="size-4" />
					{:else}
						<PauseIcon class="size-4" />
					{/if}
				</button>
			{/if}

			<button
				type="button"
				class="text-danger-soft-fg hover:bg-danger-soft flex min-h-9 flex-1 items-center justify-center px-3 transition-colors duration-100 {!isComplete
					? 'border-border border-t'
					: ''}"
				aria-label="Cancel {timer.name}"
				onclick={() => oncancel(timer.id)}
			>
				<XIcon class="size-4" />
			</button>
		</div>
	</div>
</Card>
