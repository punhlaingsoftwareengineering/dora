<script lang="ts">
	/* Wash base first; app Tailwind utilities must load after. */
	import '@menzies-mariesta-com/menzies-design-wash-ui/styles.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import { WashThemeTool } from '$lib/tool/wash-theme.tool.svelte';

	let { children } = $props();

	const washThemeTool = new WashThemeTool();

	onMount(() => {
		washThemeTool.boot();
		return () => washThemeTool.destroy();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class={washRecipes.washShell}>
	{@render children()}
</div>
