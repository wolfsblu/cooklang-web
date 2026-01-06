<script lang="ts">
	import { ChefHatIcon, ShoppingCartIcon, RefrigeratorIcon } from '@lucide/svelte';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	const links = [
		{ label: 'Recipes', href: '/recipes', icon: ChefHatIcon },
		{ label: 'Shopping', href: '/shopping', icon: ShoppingCartIcon },
		{ label: 'Pantry', href: '/pantry', icon: RefrigeratorIcon },
	];
</script>
	
<Navigation layout="bar" class="shadow-[0px_-20px_20px_-15px_rgba(0,0,0,0.1)]">
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