<script lang="ts">
	import { ChefHatIcon, ShoppingCartIcon, RefrigeratorIcon } from '@lucide/svelte';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	const links = [
		{ label: 'Recipes', href: '/recipes', icon: ChefHatIcon },
		{ label: 'Shopping', href: '/shopping', icon: ShoppingCartIcon },
		{ label: 'Pantry', href: '/pantry', icon: RefrigeratorIcon },
	];
</script>

	
<Navigation layout="bar">
	<Navigation.Menu class="grid grid-cols-3 gap-2">
		{#each links as link (link)}
			{@const Icon = link.icon}
			<Navigation.TriggerAnchor href={link.href}>
				<Icon class="size-5" />
				<Navigation.TriggerText>{link.label}</Navigation.TriggerText>
			</Navigation.TriggerAnchor>
		{/each}
	</Navigation.Menu>
</Navigation>