<script lang="ts">
	import { ChefHatIcon, ShoppingCartIcon, RefrigeratorIcon, SunIcon, MoonIcon } from '@lucide/svelte';
	import { Navigation, Switch } from '@skeletonlabs/skeleton-svelte';
	import { modeStore } from '$lib/stores/theme.svelte';

	const links = [
		{ label: 'Recipes', href: '/', icon: ChefHatIcon },
		{ label: 'Shopping', href: '/shopping', icon: ShoppingCartIcon },
		{ label: 'Pantry', href: '/pantry', icon: RefrigeratorIcon },
	];

	let checked = $state(false);

	$effect(() => {
		checked = modeStore.current === 'dark';
	});

	const onCheckedChange = (event: { checked: boolean }) => {
		const mode = event.checked ? 'dark' : 'light';
		modeStore.set(mode);
	};
</script>

<Navigation layout="bar" class="shadow-[0px_-20px_20px_-15px_rgba(0,0,0,0.1)]">
	<Navigation.Menu class="flex items-center justify-between px-2">
		<div class="flex-1"></div>
		<div class="flex gap-2">
			{#each links as link (link)}
				{@const Icon = link.icon}
				<Navigation.TriggerAnchor href={link.href}>
					<Icon class="size-5" />
					<Navigation.TriggerText>{link.label}</Navigation.TriggerText>
				</Navigation.TriggerAnchor>
			{/each}
		</div>
		<div class="flex-1 flex justify-end items-center p-2">
			<Switch {checked} {onCheckedChange}>
				<Switch.Control>
					<Switch.Thumb>
						{#if checked}
							<MoonIcon class="size-4" />
						{:else}
							<SunIcon class="size-4" />
						{/if}
					</Switch.Thumb>
				</Switch.Control>
				<Switch.HiddenInput />
			</Switch>
		</div>
	</Navigation.Menu>
</Navigation>