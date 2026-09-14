<script lang="ts">
	import { Globe } from 'lucide-svelte';
	import { resolveBrandFromUrlOrPattern } from '$lib/tool/site-brand';

	let {
		urlPattern,
		size = 32,
		class: className = 'size-8 shrink-0'
	}: {
		urlPattern: string;
		size?: number;
		class?: string;
	} = $props();

	const brand = $derived(resolveBrandFromUrlOrPattern(urlPattern));
</script>

{#if brand}
	<svg
		role="img"
		viewBox="0 0 24 24"
		width={size}
		height={size}
		class={className}
		aria-hidden="true"
	>
		<title>{brand.title}</title>
		<path d={brand.path} fill={`#${brand.hex}`} />
	</svg>
{:else}
	<span class="inline-flex {className} items-center justify-center text-base-content/45" aria-hidden="true">
		<Globe {size} />
	</span>
{/if}
