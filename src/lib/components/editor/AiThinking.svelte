<script lang="ts">
	interface Props {
		model: string;
	}

	const { model }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center gap-4 py-8 text-center"
	role="status"
	aria-live="polite"
>
	<div class="flex items-center gap-2" aria-hidden="true">
		<span class="ai-dot bg-accent size-2.5 rounded-full"></span>
		<span class="ai-dot bg-accent2 size-2.5 rounded-full" style="animation-delay: 150ms"></span>
		<span class="ai-dot bg-accent size-2.5 rounded-full" style="animation-delay: 300ms"></span>
	</div>

	<div>
		<p class="text-fg text-sm font-medium">
			Reading the recipe and asking <span class="text-accent">{model}</span>…
		</p>
		<p class="text-fg-subtle mt-1 text-xs">
			Extracting ingredients, matching your library vocabulary and writing Cooklang.
		</p>
	</div>
</div>
