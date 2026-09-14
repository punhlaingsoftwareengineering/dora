<script lang="ts">
	/**
	 * Submit button with Wash-sized spinner (loading-sm), not daisyUI `btn.loading`
	 * which paints an oversized radial for default btn height.
	 */
	import type { Snippet } from 'svelte';

	let {
		loading = false,
		loadingText = 'Loading…',
		disabled = false,
		class: className = '',
		type = 'submit',
		formaction,
		onclick,
		children
	}: {
		loading?: boolean;
		loadingText?: string;
		disabled?: boolean;
		class?: string;
		type?: 'button' | 'submit' | 'reset';
		formaction?: string;
		onclick?: (e: MouseEvent & { currentTarget: HTMLButtonElement }) => void | Promise<void>;
		children: Snippet;
	} = $props();

	const busy = $derived(loading || disabled);
</script>

<button
	class="btn {className}"
	class:cursor-pointer={!busy}
	class:cursor-not-allowed={busy}
	class:btn-disabled={busy}
	{type}
	{formaction}
	{onclick}
	disabled={busy}
	aria-busy={loading || undefined}
>
	{#if loading}
		<span class="inline-flex items-center justify-center gap-2">
			<span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
			<span>{loadingText}</span>
		</span>
	{:else}
		{@render children()}
	{/if}
</button>
