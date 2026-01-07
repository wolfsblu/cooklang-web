<script lang="ts">
    import { X, Volume2, VolumeX } from '@lucide/svelte'
    import type { ActiveTimer } from '$lib/types/recipe'
    import TimerCard from './TimerCard.svelte'

    interface Props {
        timers: ActiveTimer[]
        audioEnabled: boolean
        onclose: () => void
        ontoggleaudio: () => void
        onpause: (id: string) => void
        onresume: (id: string) => void
        oncancel: (id: string) => void
    }

    const { timers, audioEnabled, onclose, ontoggleaudio, onpause, onresume, oncancel }: Props = $props()
</script>

<aside class="fixed right-0 top-0 bottom-0 w-80 max-w-full bg-surface-100-900 border-l border-surface-200-800 shadow-xl z-40 flex flex-col">
    <header class="flex items-center justify-between p-4 border-b border-surface-200-800">
        <h2 class="h5">Active Timers</h2>
        <div class="flex items-center gap-2">
            <button
                type="button"
                class="btn btn-sm preset-tonal-surface"
                onclick={ontoggleaudio}
                aria-label={audioEnabled ? 'Mute alerts' : 'Unmute alerts'}
            >
                {#if audioEnabled}
                    <Volume2 class="size-4" />
                {:else}
                    <VolumeX class="size-4" />
                {/if}
            </button>
            <button
                type="button"
                class="btn btn-sm preset-tonal-surface"
                onclick={onclose}
                aria-label="Close panel"
            >
                <X class="size-4" />
            </button>
        </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 space-y-3">
        {#if timers.length === 0}
            <p class="text-surface-500-500 text-center py-8">
                No active timers.<br />
                <span class="text-sm">Click a timer in a recipe step to start one.</span>
            </p>
        {:else}
            {#each timers as timer (timer.id)}
                <TimerCard
                    {timer}
                    {onpause}
                    {onresume}
                    {oncancel}
                />
            {/each}
        {/if}
    </div>
</aside>
