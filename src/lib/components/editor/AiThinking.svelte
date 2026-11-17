<script lang="ts">
	interface Props {
		model: string;
		/** Changes the wording and the explanation under it. */
		kind?: 'url' | 'photo';
	}

	const { model, kind = 'url' }: Props = $props();

	const heading = $derived(kind === 'photo' ? 'Reading the photo' : 'Reading the recipe');
	const detail = $derived(
		kind === 'photo'
			? 'Transcribing the visible ingredients and method, matching your library vocabulary and writing Cooklang.'
			: 'Extracting ingredients, matching your library vocabulary and writing Cooklang.'
	);
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
			{heading} and asking <span class="text-accent">{model}</span>…
		</p>
		<p class="text-fg-subtle mt-1 text-xs">
			{detail}
		</p>
	</div>
</div>
