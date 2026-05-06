<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import DesktopTitleBar from '$lib/ui/DesktopTitleBar.svelte';
	import { onMount } from 'svelte';
	import { initDeviceStorage } from '$lib/deviceStorage';

	let { children } = $props();
	let storageReady = $state(false);

	onMount(() => {
		void initDeviceStorage().then(() => {
			storageReady = true;
		});
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div data-theme="sunset" class="flex min-h-screen flex-col antialiased">
	<DesktopTitleBar />
	{#if !storageReady}
		<div class="flex flex-1 items-center justify-center bg-base-200">
			<div class="flex flex-col items-center gap-3">
				<span class="loading loading-spinner loading-lg text-primary" aria-label="Loading"></span>
				<p class="text-sm text-base-content/60">Loading…</p>
			</div>
		</div>
	{:else}
		{@render children()}
	{/if}
</div>
