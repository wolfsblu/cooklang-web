<script lang="ts">
    import type { CooklangRecipe } from "@cooklang/cooklang";

const imgSrc =
	'https://images.unsplash.com/photo-1463171515643-952cee54d42a?q=80&w=450&h=190&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

	interface Props {
		recipe: {
			filename: string
			content: string
			markup: string
			report: string
			parsed: CooklangRecipe
		}
	}

	const {
		recipe
	}: Props = $props()

	const url = `/recipes/${recipe.filename}`
</script>
<a
	href={url}
	class="card preset-filled-surface-100-900 border border-surface-200-800 card-hover divide-surface-200-800 block divide-y overflow-hidden"
>
	<header>
		<img src={imgSrc} class="aspect-21/9 w-full grayscale hue-rotate-90" alt="banner" />
	</header>

    <article class="space-y-2 p-2">
        <h1 class="h5">{recipe.parsed.title}</h1>
	</article>

    <footer class="flex items-center justify-between gap-2 p-2">
		<small class="opacity-60">Alex</small>
		<small class="opacity-60">{new Date().toLocaleDateString()}</small>
	</footer>
</a>