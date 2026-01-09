<script lang="ts">
    import { ChevronLeft, ChevronRight, Timer, Check, X } from '@lucide/svelte'

    interface Props {
        currentStep: number
        totalSteps: number
        activeTimerCount: number
        onprevious: () => void
        onnext: () => void
        onfinish: () => void
        ontoggletimers: () => void
    }

    const { currentStep, totalSteps, activeTimerCount, onprevious, onnext, onfinish, ontoggletimers }: Props = $props()

    const isFirstStep = $derived(currentStep === 1)
    const isLastStep = $derived(currentStep === totalSteps)
    const progressPercent = $derived(totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0)
</script>

<div class="fixed bottom-0 left-0 right-0 bg-surface-100-900 border-t border-surface-200-800 shadow-lg z-30">
    <!-- Progress bar -->
    <div class="h-1 bg-surface-200-800">
        <div
            class="h-full bg-primary-500 transition-all duration-300"
            style="width: {progressPercent}%"
        ></div>
    </div>

    <div class="flex items-center justify-between gap-4 px-4 py-3">
        <!-- Previous button -->
        <button
            type="button"
            class="btn preset-tonal-surface"
            onclick={onprevious}
            disabled={isFirstStep}
            aria-label="Previous step"
        >
            <ChevronLeft class="size-5" />
            <span class="hidden sm:inline">Previous</span>
        </button>

        <!-- Center section: Exit button, step counter and timer badge -->
        <div class="flex items-center gap-4">
            <button
                type="button"
                class="btn preset-tonal-surface size-9 p-0"
                onclick={onfinish}
                aria-label="Exit cook mode"
            >
                <X class="size-5" />
            </button>

            <span class="font-medium text-sm">
                Step {currentStep} of {totalSteps}
            </span>

            {#if activeTimerCount > 0}
                <button
                    type="button"
                    class="btn preset-filled-warning size-9 p-0 relative"
                    onclick={ontoggletimers}
                    aria-label="Show active timers"
                >
                    <Timer class="size-5" />
                    <span class="absolute -top-1 -right-1 bg-error-500 text-white text-xs rounded-full size-4 flex items-center justify-center">{activeTimerCount}</span>
                </button>
            {:else}
                <button
                    type="button"
                    class="btn preset-tonal-surface size-9 p-0 opacity-60"
                    onclick={ontoggletimers}
                    aria-label="Show timers panel"
                >
                    <Timer class="size-5" />
                </button>
            {/if}
        </div>

        <!-- Next/Finish button -->
        {#if isLastStep}
            <button
                type="button"
                class="btn preset-filled-success"
                onclick={onfinish}
                aria-label="Finish cooking"
            >
                <Check class="size-5" />
                <span class="hidden sm:inline">Finish</span>
            </button>
        {:else}
            <button
                type="button"
                class="btn preset-filled-primary"
                onclick={onnext}
                aria-label="Next step"
            >
                <span class="hidden sm:inline">Next</span>
                <ChevronRight class="size-5" />
            </button>
        {/if}
    </div>
</div>
