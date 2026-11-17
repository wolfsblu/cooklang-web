<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from '@lucide/svelte';
	import Card from '#lib/components/ui/Card.svelte';
	import Page from '#lib/components/ui/Page.svelte';
	import { getStoredTheme, setTheme, type Theme } from '#lib/theme.js';

	type ThemeOption = {
		value: Theme;
		label: string;
		description: string;
		icon: Component<{ class?: string }>;
	};

	const options: readonly ThemeOption[] = [
		{ value: 'light', label: 'Light', description: 'Always use the light palette.', icon: SunIcon },
		{ value: 'dark', label: 'Dark', description: 'Always use the dark palette.', icon: MoonIcon },
		{ value: 'system', label: 'System', description: 'Match your device.', icon: MonitorIcon }
	];

	// The server cannot see localStorage, so the page starts on the default and
	// reads the stored choice once the client takes over. The palette itself is
	// already correct before paint thanks to the script in `app.html`.
	let theme = $state<Theme>('system');

	onMount(() => {
		theme = getStoredTheme();
	});

	function select(value: Theme) {
		theme = value;
		setTheme(value);
	}
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<Page title="Settings">
	<div class="max-w-3xl">
		<Card class="p-5 sm:p-6">
			<header class="mb-5">
				<h2 class="text-fg text-lg font-semibold tracking-tight">Appearance</h2>
				<p class="text-fg-muted mt-1 text-sm">
					Choose how cooklang-web looks. Your choice is saved on this device.
				</p>
			</header>

			<fieldset>
				<legend class="text-fg mb-2 text-sm font-medium">Theme</legend>

				<div class="grid gap-3 sm:grid-cols-3">
					{#each options as option (option.value)}
						{@const checked = theme === option.value}
						<label
							class="has-[:focus-visible]:outline-ring relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 {checked
								? 'border-accent bg-accent-soft'
								: 'border-border bg-surface hover:border-border-strong'}"
						>
							<input
								type="radio"
								name="theme"
								value={option.value}
								{checked}
								onchange={() => select(option.value)}
								class="sr-only"
							/>

							<option.icon
								class="mt-0.5 size-5 shrink-0 {checked ? 'text-accent-soft-fg' : 'text-fg-subtle'}"
							/>

							<span class="min-w-0 flex-1">
								<span
									class="block text-sm font-medium {checked ? 'text-accent-soft-fg' : 'text-fg'}"
								>
									{option.label}
								</span>
								<span
									class="mt-0.5 block text-xs {checked
										? 'text-accent-soft-fg/80'
										: 'text-fg-muted'}"
								>
									{option.description}
								</span>
							</span>

							{#if checked}
								<CheckIcon class="text-accent-soft-fg mt-0.5 size-4 shrink-0" strokeWidth={3} />
							{/if}
						</label>
					{/each}
				</div>
			</fieldset>
		</Card>
	</div>
</Page>
