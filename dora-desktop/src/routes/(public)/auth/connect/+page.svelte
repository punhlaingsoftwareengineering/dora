<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		getOrCreateFingerprint,
		saveConfig,
		saveConnection,
		loadConnection,
		loadConnectCredentials,
		saveConnectCredentials,
		loadPendingRequestId,
		savePendingRequestId
	} from '$lib/deviceStorage';
	import { postConnect, getRequestStatus } from '$lib/api';
	import { page } from '$app/state';
	import { resolveAppVersion } from '$lib/appVersion';
	import LogoMark from '$lib/ui/LogoMark.svelte';

	let orgName = $state('');
	let appVersion = $state<string | null>(null);
	let secretKey = $state('');
	let requestId = $state<string | null>(null);
	let status = $state<string | null>(null);
	let error = $state<string | null>(null);
	let polling = $state(false);
	let statusBanner = $state<string | null>(null);

	function replayBannerFromUrl() {
		const s = page.url.searchParams.get('status');
		if (s === 'server_unreachable') {
			statusBanner =
				'Could not reach Dora. Check your network, or try again — the app tries local dev and production hosts automatically.';
		} else if (s === 'revoked') {
			statusBanner = 'Your device access was revoked by an admin. Reconnect with a new request if allowed.';
		} else if (s === 'pending') {
			statusBanner = 'Your device is pending approval. You can’t use the app yet.';
		} else {
			statusBanner = null;
		}
	}

	async function pullRequestStatus() {
		if (!requestId) return;
		try {
			const s = await getRequestStatus(requestId);
			status = s.status;
			if (s.status === 'APPROVED' && s.orgId && s.deviceId && s.sites) {
				polling = false;
				savePendingRequestId(null);
				saveConnection({ orgId: s.orgId, deviceId: s.deviceId });
				saveConfig({ proxy: s.proxy ?? null, sites: s.sites });
				goto('/home');
				return;
			}
			if (s.status === 'REJECTED' || s.status === 'IGNORED') {
				polling = false;
				savePendingRequestId(null);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unexpected error';
			polling = false;
		}
	}

	async function connect() {
		error = null;
		const deviceFingerprint = getOrCreateFingerprint();
		if (!orgName || !secretKey) throw new Error('Missing orgName/secretKey');

		const version = appVersion ?? (await resolveAppVersion().catch(() => null));
		if (!appVersion) appVersion = version;

		const res = await postConnect({
			orgName,
			secretKey,
			deviceFingerprint,
			deviceInfo: {
				userAgent: navigator.userAgent,
				platform: navigator.platform,
				appVersion: version ?? undefined
			}
		});
		saveConnectCredentials({ orgName, secretKey });
		savePendingRequestId(res.requestId);
		requestId = res.requestId;
		status = 'PENDING';
		startPolling();
	}

	function startPolling() {
		if (!requestId) return;
		polling = true;

		const tick = async () => {
			if (!polling || !requestId) return;
			await pullRequestStatus();
			if (polling) setTimeout(tick, 1500);
		};

		tick();
	}

	onMount(() => {
		if (loadConnection()) {
			goto('/home');
			return;
		}
		const saved = loadConnectCredentials();
		if (saved) {
			orgName = saved.orgName;
			secretKey = saved.secretKey;
		}
		const pending = loadPendingRequestId();
		if (pending) {
			requestId = pending;
			status = 'PENDING';
			startPolling();
		}
		replayBannerFromUrl();
		void resolveAppVersion().then((v) => (appVersion = v));
	});
</script>

<div class="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
	<div class="w-full max-w-2xl">
		<div
			class="overflow-hidden rounded-2xl border border-base-300/60 bg-base-100 shadow-lg shadow-base-300/40"
		>
			<div class="border-b border-base-200 bg-base-200/40 px-6 py-5 sm:px-8">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="flex min-w-0 items-start gap-3">
						<LogoMark size={36} class="mt-0.5 shrink-0" />
						<div class="min-w-0">
						<h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Connect</h1>
						<p class="mt-1 max-w-md text-sm text-base-content/65">
							Use the organization <span class="font-medium">code</span> and secret key from your admin.
						</p>
						</div>
					</div>
				</div>
			</div>

			<div class="px-6 py-6 sm:px-8 sm:py-8">
				{#if statusBanner}
					<div class="alert alert-warning mb-6 rounded-xl border-0">
						<div class="text-sm">{statusBanner}</div>
					</div>
				{/if}

				{#if error}
					<div class="alert alert-error mb-6 rounded-xl"><span class="text-sm">{error}</span></div>
				{/if}

				<form
					class="space-y-6"
					onsubmit={(e) => {
						e.preventDefault();
						connect();
					}}
				>
					<div class="grid gap-5 sm:grid-cols-2 sm:gap-6">
						<label class="form-control w-full">
							<div class="label pt-0 pb-1.5">
								<span class="label-text font-medium text-base-content/80">Organization code</span>
							</div>
							<input
								class="input input-bordered input-md w-full rounded-xl border-base-300 bg-base-100"
								bind:value={orgName}
								required
								autocomplete="organization"
							/>
						</label>
						<label class="form-control w-full">
							<div class="label pt-0 pb-1.5">
								<span class="label-text font-medium text-base-content/80">Secret key</span>
							</div>
							<input
								class="input input-bordered input-md w-full rounded-xl border-base-300 bg-base-100 font-mono text-sm tracking-wide"
								placeholder="••••••••••••"
								type="password"
								bind:value={secretKey}
								required
								autocomplete="off"
							/>
						</label>
					</div>

					<button
						class="btn btn-primary btn-md w-full rounded-xl sm:w-auto sm:min-w-[10rem]"
						type="submit"
						disabled={!orgName || !secretKey || polling}
					>
						{#if polling}
							<span class="loading loading-spinner loading-sm"></span>
							Waiting…
						{:else}
							Connect
						{/if}
					</button>
				</form>

				{#if requestId}
					<div class="mt-8 rounded-xl border border-base-200 bg-base-200/35 p-4 text-sm">
						<div class="font-medium text-base-content">Request submitted</div>
						<div class="mt-2 text-base-content/70">
							ID <span class="font-mono text-xs">{requestId}</span>
						</div>
						<div class="mt-2 flex flex-wrap items-center gap-2">
							<span class="text-base-content/70">Status</span>
							<span class="badge badge-ghost badge-sm font-mono">{status ?? 'PENDING'}</span>
							{#if polling}
								<span class="loading loading-dots loading-sm text-primary" aria-label="Waiting"></span>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#if appVersion}
			<p class="mt-8 text-center text-xs text-base-content/45 tabular-nums">Version {appVersion}</p>
		{/if}
	</div>
</div>
