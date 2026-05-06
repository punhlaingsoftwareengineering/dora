<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { clearConnection, loadConnection } from '$lib/deviceStorage';
	import { getDeviceOptionsWithTimeout } from '$lib/api';
	import { resolveAppVersion } from '$lib/appVersion';

	let { children } = $props();
	let appVersion = $state<string | null>(null);
	let verifying = $state(true);
	let verifyError = $state<string | null>(null);

	onMount(() => {
		void resolveAppVersion().then((v) => (appVersion = v));
	});

	function runVerify() {
		const conn = loadConnection();
		if (!conn) {
			goto('/auth/connect');
			return;
		}

		verifying = true;
		verifyError = null;
		getDeviceOptionsWithTimeout(conn.orgId, conn.deviceId, 8000)
			.then((opt) => {
				if (
					opt.status === 'REJECTED' ||
					opt.status === 'IGNORED' ||
					opt.status === 'REVOKED'
				) {
					clearConnection();
					goto('/auth/connect?status=revoked');
					return;
				}
				if (opt.status === 'PENDING' || opt.status === 'PENDING_APPROVAL') {
					goto('/auth/connect?status=pending');
					return;
				}
				verifyError = null;
				verifying = false;
			})
			.catch(() => {
				verifyError = 'Could not reach Dora. Connect to the internet (or VPN) and retry.';
				verifying = false;
			});
	}

	onMount(() => {
		runVerify();
	});
</script>

<div class="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-base-200 to-base-300">
	{#if verifyError}
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm"
			role="alert"
		>
			<span class="text-base-content/90">{verifyError}</span>
			<button type="button" class="btn btn-warning btn-sm shrink-0" onclick={() => runVerify()}>
				Retry connection
			</button>
		</div>
	{/if}

	<main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
		{#if verifying}
			<div class="flex min-h-[45vh] flex-col items-center justify-center gap-3">
				<span class="loading loading-spinner loading-lg text-primary" aria-label="Verifying"></span>
				<p class="text-sm text-base-content/60">Checking with Dora…</p>
			</div>
		{:else if verifyError}
			<div class="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center">
				<div class="max-w-lg space-y-2">
					<h2 class="text-xl font-semibold tracking-tight">Can’t verify access</h2>
					<p class="text-sm text-base-content/65">{verifyError}</p>
				</div>
				<div class="flex flex-wrap items-center justify-center gap-2">
					<button type="button" class="btn btn-primary btn-sm" onclick={() => runVerify()}>
						Retry
					</button>
				</div>
			</div>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>
