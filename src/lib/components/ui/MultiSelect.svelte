<script lang="ts">
	import { Combobox } from 'bits-ui';
	import { flushSync, tick } from 'svelte';
	import { CheckIcon, ChevronsUpDownIcon } from '@lucide/svelte';
	import Chip from './Chip.svelte';

	/**
	 * Multi-select combobox with a filterable list and pills for the current
	 * selection inside the input.
	 */
	type Props = {
		selected: string[];
		options: string[];
		placeholder?: string;
		label: string;
		/** Called whenever the selection changes, including from the pills. */
		onchange?: (selected: string[]) => void;
	};

	let {
		selected = $bindable([]),
		options,
		placeholder = 'Search…',
		label,
		onchange
	}: Props = $props();

	let search = $state('');
	let open = $state(false);
	let input = $state<HTMLInputElement | null>(null);
	let shell = $state<HTMLDivElement | null>(null);

	const filtered = $derived(
		search ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase())) : options
	);

	/** Reset the query and the input itself, which the combobox owns. */
	function resetSearch() {
		search = '';
		if (!input) return;
		input.value = '';
		// Let the combobox see the reset too, so its internal query does not keep
		// the old label (and reopen the menu on the next backspace).
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}

	/**
	 * A multiple combobox keeps its menu open after a pick and leaves the label
	 * in the input; for a filter menu that hides the rest of the list and gets in
	 * the way of the next pick, so close and reset instead.
	 */
	async function handleValueChange(value: string[]) {
		open = false;
		onchange?.(value);
		// The combobox writes the picked label into the input after this handler,
		// so wait for that update before clearing it again.
		await tick();
		resetSearch();
	}

	/** Backspace on an empty query removes the pill just behind the caret. */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Backspace' || selected.length === 0) return;
		if (event.currentTarget instanceof HTMLInputElement && event.currentTarget.value !== '') {
			return;
		}

		event.preventDefault();

		const next = selected.slice(0, -1);
		selected = next;
		onchange?.(next);
	}

	/**
	 * Update the filtered list before the combobox sees the input event.
	 *
	 * The combobox moves its highlighted item to the first candidate when the
	 * query changes. If that runs against the previous list, the highlight lands
	 * on an item the filter is about to remove, and arrow keys stop moving
	 * because the highlighted node is no longer among the candidates.
	 */
	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		flushSync(() => {
			search = event.currentTarget.value;
		});
	}

	function remove(tag: string) {
		const next = selected.filter((t) => t !== tag);
		selected = next;
		onchange?.(next);
	}
</script>

<div class="w-full">
	<Combobox.Root
		type="multiple"
		bind:value={selected}
		bind:open
		onValueChange={handleValueChange}
		onOpenChange={(isOpen) => {
			if (!isOpen) resetSearch();
		}}
	>
		<div class="relative">
			<!-- The pills live in the input shell so the caret always trails the
			     selection, the way a tag field reads. The shell is the popup
			     anchor, so the menu lines up with the whole control. -->
			<div
				bind:this={shell}
				class="field flex min-h-10 flex-wrap items-center gap-1 py-1.5 pr-9 pl-2"
			>
				{#each selected as tag (tag)}
					<Chip label={tag} onremove={() => remove(tag)} />
				{/each}
				<Combobox.Input
					bind:ref={input}
					aria-label={label}
					{placeholder}
					oninput={handleInput}
					onkeydown={handleKeydown}
					class="text-fg placeholder:text-fg-subtle min-w-16 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none focus:ring-0"
				/>
			</div>
			<Combobox.Trigger
				class="text-fg-subtle hover:text-fg absolute inset-y-0 right-0 flex items-center px-2 transition-colors"
				aria-label="Toggle {label} options"
			>
				<ChevronsUpDownIcon class="size-4" />
			</Combobox.Trigger>
		</div>

		<Combobox.Portal>
			<Combobox.Content
				sideOffset={4}
				customAnchor={shell}
				class="bg-surface border-border shadow-pop z-50 max-h-64 w-[var(--bits-combobox-anchor-width)] overflow-y-auto rounded-md border p-1"
			>
				{#each filtered as option (option)}
					<Combobox.Item
						value={option}
						label={option}
						class="data-highlighted:bg-accent-soft data-highlighted:text-accent-soft-fg flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm"
					>
						{#snippet children({ selected: isSelected })}
							{option}
							{#if isSelected}
								<CheckIcon class="text-accent size-4" />
							{/if}
						{/snippet}
					</Combobox.Item>
				{:else}
					<p class="text-fg-subtle px-2 py-1.5 text-sm">No matches</p>
				{/each}
			</Combobox.Content>
		</Combobox.Portal>
	</Combobox.Root>
</div>
