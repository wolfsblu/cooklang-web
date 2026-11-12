<script lang="ts">
	import {
		BracesIcon,
		CarrotIcon,
		CookingPotIcon,
		MessageSquareIcon,
		TimerIcon
	} from '@lucide/svelte';

	const items = [
		{
			icon: CarrotIcon,
			title: 'Ingredient',
			syntax: '@flour&#123;200%g&#125;',
			text: 'A multi-word name needs the braces: @olive oil{2%tbsp}.'
		},
		{
			icon: CookingPotIcon,
			title: 'Cookware',
			syntax: '#frying pan&#123;&#125;',
			text: 'Cookware is what you cook in; it is collected separately from ingredients.'
		},
		{
			icon: TimerIcon,
			title: 'Timer',
			syntax: '~&#123;10%minutes&#125;',
			text: 'Give it a name with ~rest{5%minutes} so the cook mode can label it.'
		},
		{
			icon: MessageSquareIcon,
			title: 'Comment',
			syntax: '-- a note for the cook',
			text: 'Comments disappear from the rendered recipe.'
		},
		{
			icon: BracesIcon,
			title: 'Section',
			syntax: '== For the sauce ==',
			text: 'Sections split the instructions into named parts.'
		}
	];
</script>

<div class="space-y-5 text-sm">
	<p class="text-fg-muted">
		Cooklang reads names from the text itself. Ingredients and cookware are collected from every
		step and become the lists and shopping list, so the spelling in the braces is the spelling that
		will be matched.
	</p>

	<div class="space-y-4">
		{#each items as item (item.title)}
			<div>
				<h3 class="text-fg mb-1 flex items-center gap-2 text-sm font-semibold">
					<item.icon class="text-accent size-4" />
					{item.title}
				</h3>
				<code
					class="bg-surface-muted text-fg block overflow-x-auto rounded-md px-2.5 py-1.5 text-xs"
				>
					{item.syntax}
				</code>
				<p class="text-fg-muted mt-1.5 text-xs">{item.text}</p>
			</div>
		{/each}
	</div>

	<div>
		<h3 class="text-fg mb-1 text-sm font-semibold">Metadata</h3>
		<pre class="bg-surface-muted text-fg overflow-x-auto rounded-md px-2.5 py-1.5 text-xs">---
servings: 4
tags: [dinner, quick]
title: Easy pancakes
---</pre>
		<p class="text-fg-muted mt-1.5 text-xs">
			Put this at the very top of the file. The old <code>&gt;&gt; servings: 4</code> syntax still works
			but the parser warns about it.
		</p>
	</div>

	<div>
		<h3 class="text-fg mb-1 text-sm font-semibold">Quantities</h3>
		<div class="text-fg-muted space-y-1 text-xs">
			<p><code>200%g</code> — 200 grams</p>
			<p><code>2%tbsp</code> — 2 tablespoons</p>
			<p><code>1/2%cup</code> — a fraction</p>
			<p><code>1-2%cups</code> — a range</p>
			<p><code>to taste</code> — text instead of a number</p>
			<p><code>@salt&#123;&#125;</code> — no quantity at all</p>
		</div>
	</div>
</div>
