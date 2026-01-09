<script lang="ts">
    import { SearchIcon, XIcon, ArrowUp, ArrowDown } from '@lucide/svelte';

    // Search state
    let searchQuery = $state('');
    let searchInputRef: HTMLInputElement | null = $state(null);

    // Sort state
    let sortField = $state('name');
    let sortOrder = $state<'asc' | 'desc'>('asc');

    // Clear search
    function clearSearch() {
        searchQuery = '';
        searchInputRef?.focus();
    }

    // Toggle sort order
    function toggleSortOrder() {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
</script>

<div class="sticky top-0 z-10 py-4 px-3 backdrop-blur-md" style="background-color: light-dark(color-mix(in srgb, var(--body-background-color) 90%, transparent), color-mix(in srgb, var(--body-background-color-dark) 90%, transparent))">
        <div class="flex gap-3">
            <!-- Search Input Container -->
            <div class="relative flex-1">
                <!-- Search Icon -->
                <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-600-400">
                    <SearchIcon class="size-5" />
                </div>

                <!-- Search Input -->
                <input
                    bind:this={searchInputRef}
                    bind:value={searchQuery}
                    type="text"
                    placeholder="Search recipes by name, tags, course, or ingredients..."
                    class="input w-full pl-10 pr-10 py-3"
                    aria-label="Search recipes"
                />

                <!-- Clear Button -->
                {#if searchQuery}
                    <button
                        onclick={clearSearch}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-600-400 hover:text-surface-900-50 transition-colors"
                        aria-label="Clear search"
                        type="button"
                    >
                        <XIcon class="size-5" />
                    </button>
                {/if}
            </div>

            <!-- Sort Field Dropdown -->
            <select
                bind:value={sortField}
                class="input py-3 px-4 w-40 flex-shrink-0"
                aria-label="Sort by field"
            >
                <option value="name">Name</option>
                <option value="time">Time</option>
                <option value="servings">Servings</option>
            </select>

            <!-- Sort Order Toggle Button -->
            <button
                onclick={toggleSortOrder}
                class="btn preset-tonal-primary px-4 py-3 flex-shrink-0"
                aria-label="Toggle sort order"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
                {#if sortOrder === 'asc'}
                    <ArrowUp class="size-5" />
                {:else}
                    <ArrowDown class="size-5" />
                {/if}
            </button>
        </div>
</div>
