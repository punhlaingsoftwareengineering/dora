<script lang="ts">
	/* Wash base first; app Tailwind utilities must load after. */
	import '@menzies-mariesta-com/menzies-design-wash-ui/styles.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import DesktopTitleBar from '$lib/ui/DesktopTitleBar.svelte';
	import { onMount } from 'svelte';
	import { initDeviceStorage } from '$lib/deviceStorage';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import { WashThemeTool } from '$lib/tool/wash-theme.tool.svelte';

	let { children } = $props();
	let storageReady = $state(false);

	const washThemeTool = new WashThemeTool();

	onMount(() => {
		washThemeTool.boot();
		void initDeviceStorage().then(() => {
			storageReady = true;
		});
		return () => washThemeTool.destroy();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="{washRecipes.washShell} flex min-h-screen flex-col antialiased">
	<DesktopTitleBar />
	{#if !storageReady}
		<div class="flex flex-1 items-center justify-center">
			<div class="flex flex-col items-center gap-3">
				<span class="{washRecipes.loading} loading-lg text-primary" aria-label="Loading"></span>
				<p class="text-sm text-base-content/60">Loading…</p>
			</div>
		</div>
	{:else}
		{@render children()}
	{/if}
</div>
