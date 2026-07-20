<script lang="ts">
	import { ArrowRight, Pencil } from '@lucide/svelte';

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

	let { data, params } = $props<{
		data: { devices: Device[]; role: string | null };
		params: { id: string };
	}>();

	let devices = $state<Device[]>([]);
	let renameTarget = $state<{ id: string; deviceName: string } | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		devices = data.devices ?? [];
	});

	let canManage = $derived(data.role === 'owner' || data.role === 'admin');

	async function refresh() {
		const res = await fetch(`/api/orgs/${params.id}/devices`);
		const json = await res.json();
		if (json.ok) devices = json.devices;
	}

	async function saveRename() {
		if (!renameTarget) return;
		const res = await fetch(`/api/orgs/${params.id}/devices/${renameTarget.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ deviceName: renameTarget.deviceName })
		});
		const json = await res.json();
		if (!json.ok) {
			error = json.error?.message ?? 'Rename failed';
			return;
		}
		renameTarget = null;
		await refresh();
	}
</script>

<div class="flex items-start justify-between">
	<div>
		<h1 class="text-2xl font-bold">Devices</h1>
		<p class="text-base-content/70">Only accepted devices appear here.</p>
	</div>
	<a class="btn" href={`/home/${params.id}`}>Back</a>
</div>

{#if error}
	<div class="alert alert-error mt-4"><span>{error}</span></div>
{/if}

<div class="mt-6 overflow-x-auto rounded-box bg-base-100 shadow">
	<table class="table">
		<thead>
			<tr>
				<th>#</th>
				<th>Name</th>
				<th>Status</th>
				<th>Current URL</th>
				<th>User</th>
				<th>Hostname</th>
				<th>OS</th>
				<th>Last seen</th>
				<th>IP</th>
				<th>App version</th>
				<th class="text-right">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#if devices.length === 0}
				<tr><td colspan="11" class="text-base-content/70">No devices yet.</td></tr>
			{:else}
				{#each devices as d, i (d.id)}
					<tr>
						<td class="text-base-content/60">{i + 1}</td>
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
								<span class="ml-1 text-xs text-base-content/60">{d.freshness}</span>
							{/if}
						</td>
						<td class="font-mono text-xs max-w-[180px] truncate">{d.lastCurrentUrl ?? '-'}</td>
						<td class="font-mono text-xs">{d.username ?? '-'}</td>
						<td class="font-mono text-xs">{d.hostname ?? '-'}</td>
						<td class="text-xs">{d.os ?? '-'}</td>
						<td>{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '-'}</td>
						<td class="font-mono text-xs">{d.lastIp ?? '-'}</td>
						<td class="font-mono text-xs">{d.lastAppVersion ?? '-'}</td>
						<td class="text-right">
							<div class="join">
								{#if canManage}
									<button
										class="btn btn-sm join-item"
										type="button"
										onclick={() => {
											renameTarget = { id: d.id, deviceName: d.deviceName };
											(document.getElementById('modal-rename') as HTMLDialogElement).showModal();
										}}
									>
										<Pencil size={14} />
									</button>
								{/if}
								<a class="btn btn-sm join-item" href={`/home/${params.id}/devices/${d.id}`}>
									Live <ArrowRight size={16} />
								</a>
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<dialog id="modal-rename" class="modal">
	<div class="modal-box">
		<h3 class="font-bold text-lg">Rename device</h3>
		{#if renameTarget}
			<label class="form-control mt-3">
				<div class="label"><span class="label-text">Device name</span></div>
				<input class="input input-bordered" bind:value={renameTarget.deviceName} />
			</label>
		{/if}
		<div class="modal-action">
			<form method="dialog"><button class="btn">Cancel</button></form>
			<button
				class="btn btn-primary"
				type="button"
				onclick={async () => {
					await saveRename();
					(document.getElementById('modal-rename') as HTMLDialogElement).close();
				}}
			>
				Save
			</button>
		</div>
	</div>
</dialog>
