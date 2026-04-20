<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initDeviceStorage } from '$lib/deviceStorage';
	import { checkForUpdate, relaunchApp, type DownloadEvent, type UpdateHandle } from '$lib/updater';

	let { children } = $props();
	let storageReady = $state(false);

	const UPDATE_DISMISS_KEY = 'wb.updateBanner.dismiss';

	let pendingUpdate = $state<{ version: string; handle: UpdateHandle } | null>(null);
	let updateBannerDismissed = $state(false);
	let updateBannerInstalling = $state(false);
	let updateBannerError = $state<string | null>(null);

	onMount(() => {
		updateBannerDismissed = sessionStorage.getItem(UPDATE_DISMISS_KEY) === '1';

		void initDeviceStorage().then(() => {
			storageReady = true;
			void (async () => {
				try {
					const u = await checkForUpdate();
					if (u) pendingUpdate = { version: u.version, handle: u };
				} catch {
					// Dev build, offline, or updater not configured — ignore.
				}
			})();
		});
	});

	function dismissUpdateBanner() {
		sessionStorage.setItem(UPDATE_DISMISS_KEY, '1');
		updateBannerDismissed = true;
		updateBannerError = null;
	}

	async function installPendingUpdate() {
		if (!pendingUpdate) return;
		updateBannerError = null;
		updateBannerInstalling = true;
		const handle = pendingUpdate.handle;
		try {
			await handle.downloadAndInstall((evt: DownloadEvent) => {
				if (evt.event === 'Finished') {
					void relaunchApp();
				}
			});
			await relaunchApp();
		} catch (e) {
			updateBannerInstalling = false;
			updateBannerError = e instanceof Error ? e.message : 'Update failed';
		}
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div data-theme="winter" class="min-h-screen antialiased">
	{#if !storageReady}
		<div class="flex min-h-screen items-center justify-center bg-base-200">
			<div class="flex flex-col items-center gap-3">
				<span class="loading loading-spinner loading-lg text-primary" aria-label="Loading"></span>
				<p class="text-sm text-base-content/60">Loading…</p>
			</div>
		</div>
	{:else}
		{#if pendingUpdate && !updateBannerDismissed}
			<div
				class="flex flex-col gap-2 border-b border-info/30 bg-info/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
				role="alert"
			>
				<div class="min-w-0 text-sm text-base-content">
					<span class="font-medium">Update available</span>
					<span class="text-base-content/80">
						— version <span class="font-mono tabular-nums">{pendingUpdate.version}</span> is ready to install.
					</span>
				</div>
				<div class="flex shrink-0 flex-wrap items-center gap-2">
					{#if updateBannerError}
						<span class="max-w-md truncate text-xs text-error" title={updateBannerError}>{updateBannerError}</span>
					{/if}
					<button
						type="button"
						class="btn btn-primary btn-sm"
						disabled={updateBannerInstalling}
						onclick={installPendingUpdate}
					>
						{#if updateBannerInstalling}
							<span class="loading loading-spinner loading-xs"></span>
							Installing…
						{:else}
							Download & restart
						{/if}
					</button>
					<button type="button" class="btn btn-ghost btn-sm" disabled={updateBannerInstalling} onclick={dismissUpdateBanner}>
						Later
					</button>
				</div>
			</div>
		{/if}
		{@render children()}
	{/if}
</div>
