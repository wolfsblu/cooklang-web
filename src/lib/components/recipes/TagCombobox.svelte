<script lang="ts">
	import { Combobox } from '@skeletonlabs/skeleton-svelte';

	interface Props {
		selectedTags: string[];
		availableTags: string[];
	}

	let { selectedTags = $bindable([]), availableTags }: Props = $props();

	let searchQuery = $state('');
	let isOpen = $state(false);

	// Computed properties
	let filteredTags = $derived(
		availableTags.filter((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	let visibleSelectedTags = $derived(selectedTags.slice(0, 5));
	let hiddenCount = $derived(Math.max(0, selectedTags.length - 5));

	// Toggle tag selection
	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	// Remove tag from selected
	function removeTag(tag: string) {
		selectedTags = selectedTags.filter((t) => t !== tag);
	}

	// Check if tag is selected
	function isSelected(tag: string): boolean {
		return selectedTags.includes(tag);
	}
</script>

<Combobox.Root
	multiple={true}
	onOpenChange={(e) => (isOpen = e.open)}
	class="relative"
	aria-label="Filter by tags"
>
	<Combobox.Control
		class="w-full min-h-[2.5rem] rounded-container-token border border-surface-200-800 bg-surface-50-950 px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500"
	>
		<!-- Display selected tags (first 5) + "X more" indicator -->
		<div class="flex flex-wrap gap-2 items-center">
			{#if visibleSelectedTags.length > 0}
				{#each visibleSelectedTags as tag (tag)}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						class="chip preset-filled-primary-500 flex items-center gap-1 group"
					>
						<span class="truncate max-w-[150px]">{tag}</span>
						<span class="opacity-70 group-hover:opacity-100">×</span>
					</button>
				{/each}
				{#if hiddenCount > 0}
					<span class="badge preset-tonal-surface text-xs">and {hiddenCount} more</span>
				{/if}
			{/if}

			<!-- Search Input -->
			<Combobox.Input
				bind:value={searchQuery}
				placeholder={selectedTags.length === 0 ? 'Search tags...' : ''}
				class="flex-1 min-w-[120px] bg-transparent border-none outline-none focus:ring-0 text-sm"
				aria-label="Search tags"
			/>

			<!-- Dropdown trigger indicator -->
			<Combobox.Trigger class="ml-auto pl-2 text-surface-600-400 hover:text-surface-900-100">
				{#if isOpen}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</Combobox.Trigger>
		</div>
	</Combobox.Control>

	<Combobox.Positioner class="z-[100]">
		<Combobox.Content
			class="w-full mt-1 max-h-[300px] overflow-y-auto rounded-container-token border border-surface-200-800 bg-surface-50-950 shadow-lg"
		>
			{#if filteredTags.length === 0}
				<div class="px-4 py-3 text-sm text-surface-600-400">No tags found</div>
			{:else}
				{#each filteredTags as tag (tag)}
					<Combobox.Item
						value={tag}
						onclick={() => toggleTag(tag)}
						class="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-surface-200-800 transition-colors {isSelected(
							tag
						)
							? 'bg-surface-100-900'
							: ''}"
					>
						<Combobox.ItemIndicator class="w-5 h-5 flex items-center justify-center">
							{#if isSelected(tag)}
								<svg class="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							{/if}
						</Combobox.ItemIndicator>
						<Combobox.ItemText class="text-sm flex-1">{tag}</Combobox.ItemText>
					</Combobox.Item>
				{/each}
			{/if}
		</Combobox.Content>
	</Combobox.Positioner>
</Combobox.Root>
