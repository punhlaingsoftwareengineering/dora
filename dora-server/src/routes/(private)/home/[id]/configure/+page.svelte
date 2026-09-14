<script lang="ts">
	import { CircleCheck, CircleX, Plus, RotateCw, Trash2 } from '@lucide/svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';

	type Toast = { tone: 'success' | 'error'; message: string } | null;
	type SiteRow = { id: string; label: string; urlPattern: string };

	let { params, data } = $props<{
		params: { id: string };
		data: {
			org: { id: string; name: string } | null;
			role: string | null;
			proxy: { host: string; port: number } | null;
			sites: SiteRow[];
			activeSecret: { orgNameCurrent: string } | null;
		};
	}>();

	let error = $state<string | null>(null);
	let toast = $state<Toast>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let busy = $state<string | null>(null);

	let activeSecret = $state<{ orgNameCurrent: string } | null>(null);
	let proxy = $state<{ host: string; port: number } | null>(null);
	let sites = $state<SiteRow[]>([]);
	let proxyHost = $state('');
	let proxyPort = $state(8080);
	let newLabel = $state('');
	let newPattern = $state('');
	let rotated = $state<{ orgName: string; secretKey: string } | null>(null);

	$effect(() => {
		activeSecret = data.activeSecret;
		proxy = data.proxy;
		sites = data.sites ?? [];
		proxyHost = data.proxy?.host ?? '';
		proxyPort = data.proxy?.port ?? 8080;
	});

	function showToast(tone: 'success' | 'error', message: string) {
		if (toastTimer) clearTimeout(toastTimer);
		toast = { tone, message };
		toastTimer = setTimeout(() => {
			toast = null;
			toastTimer = null;
		}, 4000);
	}

	async function withBusy(key: string, fn: () => Promise<void>, okMessage: string) {
		error = null;
		busy = key;
		try {
			await fn();
			showToast('success', okMessage);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unexpected error';
			error = message;
			showToast('error', message);
		} finally {
			busy = null;
		}
	}

	async function refresh() {
		const res = await fetch(`/api/orgs/${params.id}`);
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Failed to load');
		activeSecret = json.activeSecret;
		proxy = json.proxy;
		sites = json.sites;
		proxyHost = json.proxy?.host ?? '';
		proxyPort = json.proxy?.port ?? 8080;
	}

	async function saveProxy() {
		await withBusy(
			'saveProxy',
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/proxy`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ orgId: params.id, host: proxyHost, port: proxyPort })
				});
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Save proxy failed');
				await refresh();
			},
			'Proxy saved'
		);
	}

	async function clearProxy() {
		await withBusy(
			'clearProxy',
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/proxy`, { method: 'DELETE' });
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Delete proxy failed');
				await refresh();
			},
			'Proxy cleared'
		);
	}

	async function addSite() {
		await withBusy(
			'addSite',
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/sites`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						orgId: params.id,
						label: newLabel,
						urlPattern: newPattern
					})
				});
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Add site failed');
				newLabel = '';
				newPattern = '';
				await refresh();
			},
			'Site added'
		);
	}

	async function deleteSite(siteId: string) {
		await withBusy(
			`deleteSite:${siteId}`,
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/sites/${siteId}`, {
					method: 'DELETE'
				});
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Delete site failed');
				await refresh();
			},
			'Site removed'
		);
	}

	async function rotateSecret() {
		await withBusy(
			'rotateSecret',
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/secret/rotate`, { method: 'POST' });
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Rotate failed');
				rotated = { orgName: json.orgName, secretKey: json.secretKey };
				(document.getElementById('modal-rotated') as HTMLDialogElement).showModal();
				await refresh();
			},
			'Org secret generated'
		);
	}
</script>

{#if toast}
	<div class="toast toast-bottom toast-end z-[100]">
		<div
			class="alert shadow-lg"
			class:alert-success={toast.tone === 'success'}
			class:alert-error={toast.tone === 'error'}
		>
			{#if toast.tone === 'success'}
				<CircleCheck class="h-5 w-5" aria-hidden="true" />
			{:else}
				<CircleX class="h-5 w-5" aria-hidden="true" />
			{/if}
			<span>{toast.message}</span>
		</div>
	</div>
{/if}

<header class="mb-5">
	<p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Settings</p>
	<h2 class="mt-1 text-2xl font-semibold tracking-tight text-secondary">Configure</h2>
	<p class="mt-1 text-sm text-base-content/70">
		Org connect keys, outbound proxy, and allowed website patterns.
	</p>
</header>

{#if error}
	<div class="{washRecipes.alertSoft('error')} mb-4"><span>{error}</span></div>
{/if}

<div class="grid gap-5 lg:grid-cols-2">
	<section class="{washRecipes.washPanel} border border-ink-border/50">
		<h3 class="card-title text-secondary font-bold">Organization connect keys</h3>
		<p class="text-sm text-base-content/65">
			Desktop uses the latest org code and secret. Rotating invalidates previous secrets.
		</p>
		<div class="mt-3 rounded-box border border-ink-border/40 bg-base-200/50 p-4">
			<div class="text-xs uppercase text-base-content/55">Current org code</div>
			<div class="mt-1 break-all font-mono">
				{activeSecret?.orgNameCurrent ?? '(not generated yet)'}
			</div>
		</div>
		<div class="mt-4">
			<WashSubmitButton
				type="button"
				class="btn-outline"
				loading={busy === 'rotateSecret'}
				loadingText="Generating…"
				onclick={rotateSecret}
			>
				<RotateCw size={18} aria-hidden="true" />
				Generate org code and secret
			</WashSubmitButton>
		</div>
	</section>

	<section class="{washRecipes.washPanel} border border-ink-border/50">
		<h3 class="card-title text-secondary font-bold">Proxy</h3>
		<div class="mt-2 grid gap-3 sm:grid-cols-2">
			<label class="form-control" for="proxy-host">
				<span class="label"><span class="label-text">Host</span></span>
				<input
					id="proxy-host"
					class="input input-bordered cursor-text"
					bind:value={proxyHost}
					placeholder="proxy.example.com"
				/>
			</label>
			<label class="form-control" for="proxy-port">
				<span class="label"><span class="label-text">Port</span></span>
				<input
					id="proxy-port"
					class="input input-bordered cursor-text"
					type="number"
					bind:value={proxyPort}
					min="1"
					max="65535"
				/>
			</label>
		</div>
		<div class="mt-4 flex flex-wrap gap-2">
			<WashSubmitButton
				type="button"
				class="btn-primary"
				loading={busy === 'saveProxy'}
				loadingText="Saving…"
				onclick={saveProxy}
			>
				Save
			</WashSubmitButton>
			<WashSubmitButton
				type="button"
				class="btn-ghost"
				loading={busy === 'clearProxy'}
				loadingText="Clearing…"
				disabled={!proxy}
				onclick={clearProxy}
			>
				Clear
			</WashSubmitButton>
		</div>
	</section>
</div>

<section class="{washRecipes.washPanel} mt-5 border border-ink-border/50">
	<h3 class="card-title text-secondary font-bold">Allowed websites</h3>
	<div class="mt-2 grid gap-3 lg:grid-cols-3">
		<label class="form-control lg:col-span-1" for="site-label">
			<span class="label">
				<span class="label-text">
					Label<span class="text-error align-top text-sm leading-none" aria-hidden="true">*</span>
				</span>
			</span>
			<input
				id="site-label"
				class="input input-bordered cursor-text"
				bind:value={newLabel}
				placeholder="Google"
				required
			/>
		</label>
		<label class="form-control lg:col-span-2" for="site-pattern">
			<span class="label">
				<span class="label-text">
					URL pattern<span class="text-error align-top text-sm leading-none" aria-hidden="true"
						>*</span
					>
				</span>
			</span>
			<input
				id="site-pattern"
				class="input input-bordered cursor-text"
				bind:value={newPattern}
				placeholder="https://accounts.google.com/*"
				required
			/>
		</label>
	</div>
	<div class="mt-3">
		<WashSubmitButton
			type="button"
			class="btn-primary"
			loading={busy === 'addSite'}
			loadingText="Adding…"
			disabled={!newLabel || !newPattern}
			onclick={addSite}
		>
			<Plus size={18} aria-hidden="true" />
			Add site
		</WashSubmitButton>
	</div>
	<div class="mt-4 overflow-x-auto">
		<table class={washRecipes.table}>
			<thead>
				<tr>
					<th>Actions</th>
					<th>No</th>
					<th>Label</th>
					<th>Pattern</th>
				</tr>
			</thead>
			<tbody>
				{#if sites.length === 0}
					<tr><td colspan="4" class="text-base-content/70">No allowed sites yet.</td></tr>
				{:else}
					{#each sites as s, i (s.id)}
						<tr>
							<td>
								<div class="tooltip tooltip-right tooltip-error" data-tip="Delete">
									<button
										type="button"
										class="btn btn-ghost btn-square btn-sm btn-error cursor-pointer"
										class:cursor-not-allowed={busy === `deleteSite:${s.id}`}
										disabled={busy === `deleteSite:${s.id}`}
										aria-label="Delete"
										onclick={() => deleteSite(s.id)}
									>
										{#if busy === `deleteSite:${s.id}`}
											<span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
										{:else}
											<Trash2 size={16} aria-hidden="true" />
										{/if}
									</button>
								</div>
							</td>
							<td class="text-base-content/60 tabular-nums">{i + 1}</td>
							<td class="font-medium">{s.label}</td>
							<td class="font-mono text-xs">{s.urlPattern}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>

<dialog id="modal-rotated" class="modal">
	<div class="modal-box border border-ink-border/50">
		<h3 class="card-title text-primary font-bold">New organization secret</h3>
		<p class="mt-2 text-sm text-base-content/70">Copy these now. The secret is only shown once.</p>
		{#if rotated}
			<div class="mt-4 grid gap-3">
				<div class="rounded-box border border-ink-border/40 bg-base-200/50 p-4">
					<div class="text-xs uppercase text-base-content/55">Org code</div>
					<div class="break-all font-mono">{rotated.orgName}</div>
				</div>
				<div class="rounded-box border border-ink-border/40 bg-base-200/50 p-4">
					<div class="text-xs uppercase text-base-content/55">Secret key</div>
					<div class="break-all font-mono">{rotated.secretKey}</div>
				</div>
			</div>
		{/if}
		<div class="modal-action">
			<form method="dialog"><button class="btn cursor-pointer" type="submit">Close</button></form>
		</div>
	</div>
</dialog>
