<script lang="ts">
	import { ArrowRight, Pencil, CircleCheck, CircleX } from '@lucide/svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';

	type Device = {
		id: string;
		deviceName: string;
		deviceFingerprint: string;
		lastSeenAt: string | null;
		lastIp: string | null;
		lastAppVersion: string | null;
		lastCurrentUrl?: string | null;
		online?: boolean;
		freshness?: string;
		statusCode?: string;
		username?: string | null;
		hostname?: string | null;
		os?: string | null;
	};

	type Toast = { tone: 'success' | 'error'; message: string } | null;

	let { data, params } = $props<{
		data: { devices: Device[]; role: string | null };
		params: { id: string };
	}>();

	let devices = $state<Device[]>([]);
	let renameTarget = $state<{ id: string; deviceName: string } | null>(null);
	let error = $state<string | null>(null);
	let toast = $state<Toast>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let saving = $state(false);

	$effect(() => {
		devices = data.devices ?? [];
	});

	let canManage = $derived(data.role === 'owner' || data.role === 'admin');

	function showToast(tone: 'success' | 'error', message: string) {
		if (toastTimer) clearTimeout(toastTimer);
		toast = { tone, message };
		toastTimer = setTimeout(() => {
			toast = null;
			toastTimer = null;
		}, 4000);
	}

	function formatShort(iso: string | null | undefined): string {
		if (!iso) return '-';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '-';
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	async function refresh() {
		const res = await fetch(`/api/orgs/${params.id}/devices`);
		const json = await res.json();
		if (json.ok) devices = json.devices;
	}

	async function saveRename() {
		if (!renameTarget) return;
		error = null;
		saving = true;
		try {
			const res = await fetch(`/api/orgs/${params.id}/devices/${renameTarget.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ deviceName: renameTarget.deviceName })
			});
			const json = await res.json();
			if (!json.ok) {
				const message = json.error?.message ?? 'Rename failed';
				error = message;
				showToast('error', message);
				return;
			}
			renameTarget = null;
			await refresh();
			showToast('success', 'Device renamed');
		} finally {
			saving = false;
		}
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
	<p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Fleet</p>
	<h2 class="mt-1 text-2xl font-semibold tracking-tight text-primary">Devices</h2>
	<p class="mt-1 text-sm text-base-content/70">Only accepted devices appear here.</p>
</header>

{#if error}
	<div class="{washRecipes.alertSoft('error')} mb-4"><span>{error}</span></div>
{/if}

<section class="{washRecipes.washPanel} border border-ink-border/50">
	<div class="overflow-x-auto">
		<table class={washRecipes.table}>
			<thead>
				<tr>
					<th>Actions</th>
					<th>No</th>
					<th>Name</th>
					<th>Status</th>
					<th>Current URL</th>
					<th>User</th>
					<th>Hostname</th>
					<th>OS</th>
					<th>Last seen</th>
					<th>IP</th>
					<th>App version</th>
				</tr>
			</thead>
			<tbody>
				{#if devices.length === 0}
					<tr><td colspan="11" class="text-base-content/70">No devices yet.</td></tr>
				{:else}
					{#each devices as d, i (d.id)}
						<tr>
							<td>
								<div class="flex flex-wrap gap-1">
									{#if canManage}
										<div class="tooltip tooltip-right tooltip-secondary" data-tip="Rename">
											<button
												class="btn btn-ghost btn-square btn-sm btn-secondary cursor-pointer"
												type="button"
												aria-label="Rename"
												onclick={() => {
													renameTarget = { id: d.id, deviceName: d.deviceName };
													(document.getElementById('modal-rename') as HTMLDialogElement).showModal();
												}}
											>
												<Pencil size={16} aria-hidden="true" />
											</button>
										</div>
									{/if}
									<div class="tooltip tooltip-right tooltip-primary" data-tip="Open live">
										<a
											class="btn btn-ghost btn-square btn-sm btn-primary cursor-pointer"
											href={`/home/${params.id}/devices/${d.id}`}
											aria-label="Open live"
										>
											<ArrowRight size={16} aria-hidden="true" />
										</a>
									</div>
								</div>
							</td>
							<td class="text-base-content/60 tabular-nums">{i + 1}</td>
							<td class="font-medium">{d.deviceName}</td>
							<td>
								{#if d.statusCode === 'DISABLED'}
									<span class="badge badge-warning">disabled</span>
								{:else if d.online}
									<span class="badge badge-success">online</span>
								{:else}
									<span class="badge">offline</span>
								{/if}
								{#if d.freshness}
									<span class="ms-1 text-xs text-base-content/60">{d.freshness}</span>
								{/if}
							</td>
							<td class="max-w-[180px] truncate font-mono text-xs">{d.lastCurrentUrl ?? '-'}</td>
							<td class="font-mono text-xs">{d.username ?? '-'}</td>
							<td class="font-mono text-xs">{d.hostname ?? '-'}</td>
							<td class="text-xs">{d.os ?? '-'}</td>
							<td class="text-sm whitespace-nowrap">{formatShort(d.lastSeenAt)}</td>
							<td class="font-mono text-xs">{d.lastIp ?? '-'}</td>
							<td class="font-mono text-xs">{d.lastAppVersion ?? '-'}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>

<dialog id="modal-rename" class="modal">
	<div class="modal-box border border-ink-border/50">
		<h3 class="card-title text-secondary font-bold">Rename device</h3>
		{#if renameTarget}
			<label class="form-control mt-3" for="rename-device-name">
				<span class="label">
					<span class="label-text">
						Device name<span class="text-error align-top text-sm leading-none" aria-hidden="true"
							>*</span
						>
					</span>
				</span>
				<input
					id="rename-device-name"
					class="input input-bordered cursor-text"
					bind:value={renameTarget.deviceName}
					required
				/>
			</label>
		{/if}
		<div class="modal-action">
			<form method="dialog"><button class="btn cursor-pointer" type="submit">Cancel</button></form>
			<WashSubmitButton
				type="button"
				class="btn-primary"
				loading={saving}
				loadingText="Saving…"
				disabled={!renameTarget?.deviceName}
				onclick={async () => {
					await saveRename();
					(document.getElementById('modal-rename') as HTMLDialogElement).close();
				}}
			>
				Save
			</WashSubmitButton>
		</div>
	</div>
</dialog>
