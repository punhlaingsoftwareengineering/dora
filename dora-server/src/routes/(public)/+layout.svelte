<script lang="ts">
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import { APP_VERSION } from '$lib/app-version';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<PageHeader />
	<!-- Full-bleed main so landing atmospheres are not clipped by wash-shell-main max-width -->
	<main class="w-full flex-1 pb-10 pt-0">
		{@render children()}
	</main>
	<footer class="footer footer-center border-t border-ink-border/60 bg-base-100/50 px-6 py-8 text-base-content">
		<aside class="space-y-1">
			<p class="dora-wordmark font-display text-sm font-medium tracking-tight">Dora</p>
			<p class="text-xs text-base-content/55 tabular-nums">Version {APP_VERSION}</p>
			<p class="text-xs text-base-content/55">© {new Date().getFullYear()} Controlled browsing for organizations</p>
		</aside>
	</footer>
</div>
