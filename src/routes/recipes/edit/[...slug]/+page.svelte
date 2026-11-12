<script lang="ts">
	import type { PageProps } from './$types';
	import CooklangEditor from '$lib/components/editor/CooklangEditor.svelte';

	const { data }: PageProps = $props();
</script>

{#key data.slug}
	<CooklangEditor
		slug={data.slug}
		relPath={data.relPath}
		title={data.title}
		source={data.source}
		mtimeMs={data.mtimeMs}
		vocabulary={data.vocabulary}
		preview={data.preview}
	/>
{/key}
