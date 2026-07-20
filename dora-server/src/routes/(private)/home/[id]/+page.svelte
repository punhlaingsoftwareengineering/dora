<script lang="ts">
	import { RotateCw, Plus, Trash2, Monitor, Users } from '@lucide/svelte';

	type Role = 'owner' | 'admin' | 'member' | null;

	let { params, data } = $props<{
		params: { id: string };
		data: {
			org: { id: string; name: string } | null;
			role: Role;
			activeSecret: { orgNameCurrent: string } | null;
			proxy: { host: string; port: number } | null;
			sites: { id: string; label: string; urlPattern: string }[];
			requests: {
				id: string;
				deviceFingerprint: string;
				devicePublicInfo: Record<string, unknown>;
				requestedAt: string;
				status: string;
				deviceName: string | null;
			}[];
			devices: {
				id: string;
				deviceName: string;
				online: boolean;
				freshness: string;
				lastCurrentUrl: string | null;
				lastSeenAt: string | null;
				statusCode: string;
			}[];
			members: {
				id: string;
				userId: string;
				role: string;
				email: string;
				name: string;
				createdAt: string | Date;
			}[];
			invites: {
				id: string;
				email: string;
				role: string;
				expiresAt: string;
				createdAt: string;
			}[];
		};
	}>();

	let loading = $state(false);
	let error = $state<string | null>(null);

	let org = $state<{ id: string; name: string } | null>(null);
	let role = $state<Role>(null);
	let activeSecret = $state<{ orgNameCurrent: string } | null>(null);
	let proxy = $state<{ host: string; port: number } | null>(null);
	let sites = $state<{ id: string; label: string; urlPattern: string }[]>([]);
	let requests = $state<typeof data.requests>([]);
	let devices = $state<typeof data.devices>([]);
	let members = $state<typeof data.members>([]);
	let invites = $state<typeof data.invites>([]);

	$effect(() => {
		org = data.org;
		role = data.role;
		activeSecret = data.activeSecret;
		proxy = data.proxy;
		sites = data.sites ?? [];
		requests = data.requests ?? [];
		devices = data.devices ?? [];
		members = data.members ?? [];
		invites = data.invites ?? [];
	});

	let canManage = $derived(role === 'owner' || role === 'admin');

	let proxyHost = $state('');
	let proxyPort = $state<number>(8080);
	let newLabel = $state('');
	let newPattern = $state('');
	let rotated = $state<{ orgName: string; secretKey: string } | null>(null);
	let approveTarget = $state<{ requestId: string; deviceName: string } | null>(null);
	let inviteEmail = $state('');
	let inviteRole = $state<'admin' | 'member'>('member');

	async function refresh() {
		error = null;
		try {
			const res = await fetch(`/api/orgs/${params.id}`);
			const json = await res.json();
			if (!json.ok) throw new Error(json.error?.message ?? 'Failed to load');
			org = json.org;
			role = json.role ?? role;
			proxy = json.proxy;
			sites = json.sites;
			activeSecret = json.activeSecret;
			proxyHost = json.proxy?.host ?? '';
			proxyPort = json.proxy?.port ?? 8080;

			const reqRes = await fetch(`/api/orgs/${params.id}/device-requests`);
			const reqJson = await reqRes.json();
			if (reqJson.ok) requests = reqJson.requests;

			const devRes = await fetch(`/api/orgs/${params.id}/devices`);
			const devJson = await devRes.json();
			if (devJson.ok) {
				devices = (devJson.devices ?? []).map((d: any) => ({
					id: d.id,
					deviceName: d.deviceName,
					online: d.online,
					freshness: d.freshness,
					lastCurrentUrl: d.lastCurrentUrl,
					lastSeenAt: d.lastSeenAt,
					statusCode: d.statusCode
				}));
			}

			const memRes = await fetch(`/api/orgs/${params.id}/members`);
			const memJson = await memRes.json();
			if (memJson.ok) {
				members = memJson.members ?? [];
				invites = (memJson.invites ?? []).map((i: any) => ({
					...i,
					expiresAt: typeof i.expiresAt === 'string' ? i.expiresAt : new Date(i.expiresAt).toISOString(),
					createdAt: typeof i.createdAt === 'string' ? i.createdAt : new Date(i.createdAt).toISOString()
				}));
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unexpected error';
		}
	}

	async function saveProxy() {
		const res = await fetch(`/api/orgs/${params.id}/proxy`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ orgId: params.id, host: proxyHost, port: proxyPort })
		});
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Save proxy failed');
		await refresh();
	}

	async function clearProxy() {
		const res = await fetch(`/api/orgs/${params.id}/proxy`, { method: 'DELETE' });
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Delete proxy failed');
		await refresh();
	}

	async function addSite() {
		const res = await fetch(`/api/orgs/${params.id}/sites`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ orgId: params.id, label: newLabel, urlPattern: newPattern })
		});
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Add site failed');
		newLabel = '';
		newPattern = '';
		await refresh();
	}

	async function deleteSite(siteId: string) {
		const res = await fetch(`/api/orgs/${params.id}/sites/${siteId}`, { method: 'DELETE' });
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Delete site failed');
		await refresh();
	}

	async function rotateSecret() {
		const res = await fetch(`/api/orgs/${params.id}/secret/rotate`, { method: 'POST' });
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Rotate failed');
		rotated = { orgName: json.orgName, secretKey: json.secretKey };
		(document.getElementById('modal-rotated') as HTMLDialogElement).showModal();
		await refresh();
	}

	async function decide(requestId: string, decision: 'APPROVE' | 'REJECT' | 'IGNORE', deviceName?: string) {
		const res = await fetch(`/api/orgs/${params.id}/device-requests/decide`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ requestId, decision, deviceName })
		});
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Decision failed');
		await refresh();
	}

	async function approve() {
		if (!approveTarget?.deviceName) return;
		await decide(approveTarget.requestId, 'APPROVE', approveTarget.deviceName);
		approveTarget = null;
	}

	async function sendInvite() {
		const res = await fetch(`/api/orgs/${params.id}/members`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: inviteEmail, role: inviteRole })
		});
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Invite failed');
		inviteEmail = '';
		await refresh();
	}

	async function revokeInvite(inviteId: string) {
		const res = await fetch(`/api/orgs/${params.id}/invites/${inviteId}`, { method: 'DELETE' });
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Revoke failed');
		await refresh();
	}

	async function removeMember(memberId: string) {
		const res = await fetch(`/api/orgs/${params.id}/members/${memberId}`, { method: 'DELETE' });
		const json = await res.json();
		if (!json.ok) throw new Error(json.error?.message ?? 'Remove failed');
		await refresh();
	}

	$effect(() => {
		proxyHost = data.proxy?.host ?? '';
		proxyPort = data.proxy?.port ?? 8080;
	});
</script>

{#if error}
	<div class="alert alert-error"><span>{error}</span></div>
{/if}

{#if loading}
	<div class="mt-6"><span class="loading loading-spinner" aria-label="Loading"></span></div>
{:else if org}
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">{org.name}</h1>
			<p class="text-base-content/70">
				Your role: <span class="badge badge-outline">{role}</span>
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<a class="btn" href={`/home/${params.id}/devices`}><Monitor size={18} />Devices</a>
			{#if canManage}
				<button class="btn btn-outline" type="button" onclick={rotateSecret}>
					<RotateCw size={18} />Generate org code & secret
				</button>
			{/if}
		</div>
	</div>

	<div class="mt-6 card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title">Accepted devices</h2>
			<p class="text-sm text-base-content/70">Live status from heartbeats and telemetry.</p>
			<div class="mt-4 overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>#</th>
							<th>Device name</th>
							<th>Status</th>
							<th>Last seen</th>
							<th>Current URL</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if devices.length === 0}
							<tr><td colspan="6" class="text-base-content/70">No devices yet.</td></tr>
						{:else}
							{#each devices as d, i}
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
										<span class="ml-2 text-xs text-base-content/60">{d.freshness}</span>
									</td>
									<td class="text-sm">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '-'}</td>
									<td class="font-mono text-xs max-w-[240px] truncate">{d.lastCurrentUrl ?? '-'}</td>
									<td class="text-right">
										<a class="btn btn-sm" href={`/home/${params.id}/devices/${d.id}`}>Open</a>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	{#if canManage}
		<div class="mt-6 grid gap-6 lg:grid-cols-2">
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Organization connect keys</h2>
					<p class="text-sm text-base-content/70">
						Desktop uses the latest org code + secret. Rotating invalidates previous secrets.
					</p>
					<div class="mt-3 rounded-box bg-base-200 p-4">
						<div class="text-xs uppercase text-base-content/60">Current org code</div>
						<div class="font-mono">{activeSecret?.orgNameCurrent ?? '(not generated yet)'}</div>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Proxy</h2>
					<div class="grid gap-3 sm:grid-cols-2">
						<label class="form-control">
							<div class="label"><span class="label-text">Host</span></div>
							<input class="input input-bordered" bind:value={proxyHost} placeholder="proxy.example.com" />
						</label>
						<label class="form-control">
							<div class="label"><span class="label-text">Port</span></div>
							<input class="input input-bordered" type="number" bind:value={proxyPort} min="1" max="65535" />
						</label>
					</div>
					<div class="mt-4 flex flex-wrap gap-2">
						<button class="btn btn-primary" type="button" onclick={saveProxy}>Save</button>
						<button class="btn btn-ghost" type="button" onclick={clearProxy} disabled={!proxy}>Clear</button>
					</div>
				</div>
			</div>
		</div>

		<div class="mt-6 card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">Allowed websites</h2>
				<div class="grid gap-3 lg:grid-cols-3">
					<label class="form-control lg:col-span-1">
						<div class="label"><span class="label-text">Label</span></div>
						<input class="input input-bordered" bind:value={newLabel} placeholder="Google" />
					</label>
					<label class="form-control lg:col-span-2">
						<div class="label"><span class="label-text">URL pattern</span></div>
						<input class="input input-bordered" bind:value={newPattern} placeholder="https://accounts.google.com/*" />
					</label>
				</div>
				<div class="mt-3">
					<button class="btn btn-primary" type="button" onclick={addSite} disabled={!newLabel || !newPattern}>
						<Plus size={18} />Add site
					</button>
				</div>
				<div class="mt-4 overflow-x-auto">
					<table class="table">
						<thead>
							<tr><th>#</th><th>Label</th><th>Pattern</th><th class="text-right">Actions</th></tr>
						</thead>
						<tbody>
							{#if sites.length === 0}
								<tr><td colspan="4" class="text-base-content/70">No allowed sites yet.</td></tr>
							{:else}
								{#each sites as s, i}
									<tr>
										<td class="text-base-content/60">{i + 1}</td>
										<td class="font-medium">{s.label}</td>
										<td class="font-mono text-xs">{s.urlPattern}</td>
										<td class="text-right">
											<button class="btn btn-sm btn-error" type="button" onclick={() => deleteSite(s.id)}>
												<Trash2 size={16} />
											</button>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{:else}
		<div class="mt-6 alert">
			<span>You have member access. Configuration is read-only; use Devices for monitoring.</span>
		</div>
	{/if}

	<div class="mt-6 card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title"><Users size={20} />Members</h2>
			{#if canManage}
				<div class="grid gap-3 lg:grid-cols-3">
					<label class="form-control lg:col-span-2">
						<div class="label"><span class="label-text">Invite email</span></div>
						<input class="input input-bordered" type="email" bind:value={inviteEmail} placeholder="colleague@example.com" />
					</label>
					<label class="form-control">
						<div class="label"><span class="label-text">Role</span></div>
						<select class="select select-bordered" bind:value={inviteRole}>
							<option value="member">Member</option>
							<option value="admin">Admin</option>
						</select>
					</label>
				</div>
				<button class="btn btn-primary mt-3 w-fit" type="button" onclick={sendInvite} disabled={!inviteEmail}>
					Send invite
				</button>
			{/if}

			<div class="mt-4 overflow-x-auto">
				<table class="table">
					<thead>
						<tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th class="text-right">Actions</th></tr>
					</thead>
					<tbody>
						{#each members as m, i}
							<tr>
								<td class="text-base-content/60">{i + 1}</td>
								<td class="font-medium">{m.name}</td>
								<td class="font-mono text-xs">{m.email}</td>
								<td><span class="badge badge-outline">{m.role}</span></td>
								<td class="text-right">
									{#if canManage && m.role !== 'owner'}
										<button class="btn btn-sm btn-error" type="button" onclick={() => removeMember(m.id)}>Remove</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if canManage && invites.length > 0}
				<h3 class="font-semibold mt-6">Pending invites</h3>
				<div class="overflow-x-auto mt-2">
					<table class="table">
						<thead>
							<tr><th>#</th><th>Email</th><th>Role</th><th>Expires</th><th class="text-right">Actions</th></tr>
						</thead>
						<tbody>
							{#each invites as inv, i}
								<tr>
									<td class="text-base-content/60">{i + 1}</td>
									<td class="font-mono text-xs">{inv.email}</td>
									<td><span class="badge badge-outline">{inv.role}</span></td>
									<td class="text-sm">{new Date(inv.expiresAt).toLocaleString()}</td>
									<td class="text-right">
										<button class="btn btn-sm" type="button" onclick={() => revokeInvite(inv.id)}>Revoke</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>

	{#if canManage}
		<div class="mt-6 card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">Device requests</h2>
				<p class="text-sm text-base-content/70">Approve, reject, or ignore incoming desktop device connections.</p>
				<div class="mt-4 overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>#</th>
								<th>Device name</th>
								<th>Requested</th>
								<th>Fingerprint</th>
								<th>Status</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#if requests.length === 0}
								<tr><td colspan="6" class="text-base-content/70">No requests yet.</td></tr>
							{:else}
								{#each requests as r, i}
									<tr>
										<td class="text-base-content/60">{i + 1}</td>
										<td class="font-medium">{r.deviceName ?? '—'}</td>
										<td>{new Date(r.requestedAt).toLocaleString()}</td>
										<td class="font-mono text-xs">{r.deviceFingerprint}</td>
										<td><span class="badge badge-outline">{r.status}</span></td>
										<td class="text-right">
											<div class="join">
												<button
													class="btn btn-sm btn-success join-item"
													type="button"
													disabled={r.status !== 'PENDING'}
													onclick={() => {
														approveTarget = { requestId: r.id, deviceName: '' };
														(document.getElementById('modal-approve') as HTMLDialogElement).showModal();
													}}
												>
													Approve
												</button>
												<button
													class="btn btn-sm btn-warning join-item"
													type="button"
													disabled={r.status !== 'PENDING'}
													onclick={async () => decide(r.id, 'REJECT')}
												>
													Reject
												</button>
												<button
													class="btn btn-sm join-item"
													type="button"
													disabled={r.status !== 'PENDING'}
													onclick={async () => decide(r.id, 'IGNORE')}
												>
													Ignore
												</button>
												<button
													class="btn btn-sm btn-error join-item"
													type="button"
													disabled={r.status !== 'APPROVED'}
													onclick={async () => decide(r.id, 'REJECT')}
												>
													Revoke
												</button>
											</div>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
{/if}

<dialog id="modal-rotated" class="modal">
	<div class="modal-box">
		<h3 class="font-bold text-lg">New organization secret</h3>
		<p class="mt-2 text-sm text-base-content/70">Copy these now. The secret is only shown once.</p>
		{#if rotated}
			<div class="mt-4 grid gap-3">
				<div class="rounded-box bg-base-200 p-4">
					<div class="text-xs uppercase text-base-content/60">Org code</div>
					<div class="font-mono break-all">{rotated.orgName}</div>
				</div>
				<div class="rounded-box bg-base-200 p-4">
					<div class="text-xs uppercase text-base-content/60">Secret key</div>
					<div class="font-mono break-all">{rotated.secretKey}</div>
				</div>
			</div>
		{/if}
		<div class="modal-action">
			<form method="dialog"><button class="btn">Close</button></form>
		</div>
	</div>
</dialog>

<dialog id="modal-approve" class="modal">
	<div class="modal-box">
		<h3 class="font-bold text-lg">Approve device</h3>
		<p class="mt-2 text-sm text-base-content/70">Device name is required when approving.</p>
		{#if approveTarget}
			<label class="form-control mt-3">
				<div class="label"><span class="label-text">Device name</span></div>
				<input class="input input-bordered" bind:value={approveTarget.deviceName} placeholder="Front desk iPad" />
			</label>
		{/if}
		<div class="modal-action">
			<form method="dialog"><button class="btn">Cancel</button></form>
			<button
				class="btn btn-success"
				type="button"
				disabled={!approveTarget?.deviceName}
				onclick={async () => {
					await approve();
					(document.getElementById('modal-approve') as HTMLDialogElement).close();
				}}
			>
				Approve
			</button>
		</div>
	</div>
</dialog>
