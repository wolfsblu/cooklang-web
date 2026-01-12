<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { FunnelIcon, SearchIcon, XIcon, ArrowUp, ArrowDown } from '@lucide/svelte';

    type Props = {
        allRecipes: any[];
        isDrawerOpen: boolean;
    };

    let { allRecipes, isDrawerOpen = $bindable() }: Props = $props();

    // Search state (synced with URL)
    let searchQuery = $state(page.url.searchParams.get('q') || '');
    let searchInputRef: HTMLInputElement | null = $state(null);

    // Sort state (synced with URL)
    let sortField = $state(page.url.searchParams.get('sort') || 'name');
    let sortOrder = $state<'asc' | 'desc'>((page.url.searchParams.get('order') || 'asc') as 'asc' | 'desc');

    // Debounced search
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleSearchInput() {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            updateUrl();
        }, 300);
    }

    function clearSearch() {
        searchQuery = '';
        updateUrl();
        searchInputRef?.focus();
    }

    function toggleSortOrder() {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        updateUrl();
    }

    function handleSortFieldChange() {
        updateUrl();
    }

    function updateUrl() {
        const params = new URLSearchParams(page.url.searchParams);

        if (searchQuery) {
            params.set('q', searchQuery);
        } else {
            params.delete('q');
        }

        if (sortField !== 'name') {
            params.set('sort', sortField);
        } else {
            params.delete('sort');
        }

        if (sortOrder !== 'asc') {
            params.set('order', sortOrder);
        } else {
            params.delete('order');
        }

        const queryString = params.toString();
        goto(queryString ? `?${queryString}` : '/', { keepFocus: true, noScroll: true });
    }
</script>

<div class="sticky top-0 z-10 py-4 px-3 backdrop-blur-md" style="background-color: light-dark(color-mix(in srgb, var(--body-background-color) 90%, transparent), color-mix(in srgb, var(--body-background-color-dark) 90%, transparent))">
        <div class="flex flex-col md:flex-row gap-2">
            <div class="flex grow gap-2">
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
                        oninput={handleSearchInput}
                        type="text"
                        placeholder="Search recipes"
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
            
                <button
                    onclick={() => isDrawerOpen = true}
                    class="btn preset-tonal-primary px-4 py-3"
                    aria-label="Filter recipes"
                >
                    <FunnelIcon />
                </button>
            </div>

            <div class="relative flex gap-2">
                <!-- Sort Field Dropdown -->
                <select
                    bind:value={sortField}
                    onchange={handleSortFieldChange}
                    class="input py-3 px-4"
                    aria-label="Sort by field"
                >
                    <option value="name">Name</option>
                    <option value="time">Time</option>
                    <option value="servings">Servings</option>
                </select>

                <!-- Sort Order Toggle Button -->
                <button
                    onclick={toggleSortOrder}
                    class="btn preset-tonal-primary px-4 py-3"
                    aria-label="Toggle sort order"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                    {#if sortOrder === 'asc'}
                        <ArrowUp  />
                    {:else}
                        <ArrowDown  />
                    {/if}
                </button>
            </div>
        </div>
</div>
