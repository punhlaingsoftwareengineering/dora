<script lang="ts">
	import {
		Monitor,
		Users,
		KeyRound,
		Globe,
		ArrowRight,
		CircleCheck,
		CircleX,
		RefreshCw,
		Inbox
	} from '@lucide/svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';

	type Role = 'owner' | 'admin' | 'member' | null;
	type Toast = { tone: 'success' | 'error'; message: string } | null;

	type DeviceRow = {
		id: string;
		deviceName: string;
		online: boolean;
		freshness: string;
		lastSeenAt: string | null;
		statusCode: string;
	};

	type RequestRow = {
		id: string;
		deviceFingerprint: string;
		requestedAt: string;
		status: string;
		deviceName: string | null;
	};

	type MemberRow = {
		id: string;
		userId: string;
		role: string;
		email: string;
		name: string;
	};

	type InviteRow = { id: string; email: string; role: string };
	type SiteRow = { id: string; label: string; urlPattern: string };

	let { params, data } = $props<{
		params: { id: string };
		data: {
			org: { id: string; name: string } | null;
			role: Role;
			activeSecret: { orgNameCurrent: string } | null;
			proxy: { host: string; port: number } | null;
			sites: SiteRow[];
			requests: RequestRow[];
			devices: DeviceRow[];
			members: MemberRow[];
			invites: InviteRow[];
		};
	}>();

	let error = $state<string | null>(null);
	let toast = $state<Toast>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let refreshing = $state(false);
	let busy = $state<string | null>(null);

	let org = $state<{ id: string; name: string } | null>(null);
	let role = $state<Role>(null);
	let activeSecret = $state<{ orgNameCurrent: string } | null>(null);
	let sites = $state<SiteRow[]>([]);
	let requests = $state<RequestRow[]>([]);
	let devices = $state<DeviceRow[]>([]);
	let members = $state<MemberRow[]>([]);
	let invites = $state<InviteRow[]>([]);
	let approveTarget = $state<{ requestId: string; deviceName: string } | null>(null);

	$effect(() => {
		org = data.org;
		role = data.role;
		activeSecret = data.activeSecret;
		sites = data.sites ?? [];
		requests = data.requests ?? [];
		devices = data.devices ?? [];
		members = data.members ?? [];
		invites = data.invites ?? [];
	});

	let canManage = $derived(role === 'owner' || role === 'admin');
	let onlineCount = $derived(
		devices.filter((d) => d.online && d.statusCode !== 'DISABLED').length
	);
	let offlineCount = $derived(
		devices.filter((d) => !d.online && d.statusCode !== 'DISABLED').length
	);
	let disabledCount = $derived(devices.filter((d) => d.statusCode === 'DISABLED').length);
	let pendingCount = $derived(requests.filter((r) => r.status === 'PENDING').length);
	let recentDevices = $derived(devices.slice(0, 5));
	let pendingRequests = $derived(requests.filter((r) => r.status === 'PENDING').slice(0, 5));

	function showToast(tone: 'success' | 'error', message: string) {
		if (toastTimer) clearTimeout(toastTimer);
		toast = { tone, message };
		toastTimer = setTimeout(() => {
			toast = null;
			toastTimer = null;
		}, 4000);
	}

	function formatShort(iso: string | Date | null | undefined): string {
		if (!iso) return '-';
		const d = typeof iso === 'string' || iso instanceof Date ? new Date(iso) : null;
		if (!d || Number.isNaN(d.getTime())) return '-';
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	async function withBusy(key: string, fn: () => Promise<void>, okMessage?: string) {
		error = null;
		busy = key;
		try {
			await fn();
			if (okMessage) showToast('success', okMessage);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unexpected error';
			error = message;
			showToast('error', message);
		} finally {
			busy = null;
		}
	}

	async function refresh() {
		error = null;
		refreshing = true;
		try {
			const res = await fetch(`/api/orgs/${params.id}`);
			const json = await res.json();
			if (!json.ok) throw new Error(json.error?.message ?? 'Failed to load');
			org = json.org;
			role = json.role ?? role;
			activeSecret = json.activeSecret;
			sites = json.sites;

			const reqRes = await fetch(`/api/orgs/${params.id}/device-requests`);
			const reqJson = await reqRes.json();
			if (reqJson.ok) requests = reqJson.requests;

			const devRes = await fetch(`/api/orgs/${params.id}/devices`);
			const devJson = await devRes.json();
			if (devJson.ok) {
				devices = (devJson.devices ?? []).map((d: Record<string, unknown>) => ({
					id: String(d.id),
					deviceName: String(d.deviceName),
					online: Boolean(d.online),
					freshness: String(d.freshness ?? ''),
					lastSeenAt: (d.lastSeenAt as string | null) ?? null,
					statusCode: String(d.statusCode ?? '')
				}));
			}

			const memRes = await fetch(`/api/orgs/${params.id}/members`);
			const memJson = await memRes.json();
			if (memJson.ok) {
				members = memJson.members ?? [];
				invites = (memJson.invites ?? []).map((i: Record<string, unknown>) => ({
					id: String(i.id),
					email: String(i.email),
					role: String(i.role)
				}));
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unexpected error';
		} finally {
			refreshing = false;
		}
	}

	async function decide(
		requestId: string,
		decision: 'APPROVE' | 'REJECT' | 'IGNORE',
		deviceName?: string
	) {
		await withBusy(
			`decide:${requestId}:${decision}`,
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/device-requests/decide`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ requestId, decision, deviceName })
				});
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Decision failed');
				await refresh();
				await invalidateAll();
			},
			decision === 'APPROVE'
				? 'Device approved'
				: decision === 'REJECT'
					? 'Request rejected'
					: 'Request ignored'
		);
	}

	async function approve() {
		if (!approveTarget?.deviceName) return;
		await decide(approveTarget.requestId, 'APPROVE', approveTarget.deviceName);
		approveTarget = null;
	}

	function deviceStatus(d: DeviceRow) {
		if (d.statusCode === 'DISABLED') return { label: 'disabled', class: 'badge badge-warning' };
		if (d.online) return { label: 'online', class: 'badge badge-success' };
		return { label: 'offline', class: 'badge' };
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

{#if error}
	<div class="{washRecipes.alertSoft('error')} mb-4"><span>{error}</span></div>
{/if}

{#if org}
	<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0">
			<p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Overview</p>
			<h2 class="mt-1 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
				Dashboard
			</h2>
			<p class="mt-1 max-w-xl text-sm text-base-content/70">
				{#if canManage}
					Snapshot of devices, pending access, and connection health for this org.
				{:else}
					Monitor devices for this org. Configuration is read-only for your role.
				{/if}
			</p>
		</div>
		<WashSubmitButton
			type="button"
			class="btn-ghost"
			loading={refreshing}
			loadingText="Refreshing…"
			onclick={refresh}
		>
			<RefreshCw size={18} aria-hidden="true" />
			Refresh
		</WashSubmitButton>
	</header>

	<div
		class="stats mt-6 w-full stats-vertical rounded-box border border-ink-border/50 bg-base-100/70 shadow-sm lg:stats-horizontal"
	>
		<div class="stat py-3">
			<div class="stat-figure text-success"><Monitor size={22} aria-hidden="true" /></div>
			<div class="stat-title">Online</div>
			<div class="stat-value text-success text-2xl tabular-nums">{onlineCount}</div>
			<div class="stat-desc">Live heartbeats</div>
		</div>
		<div class="stat py-3">
			<div class="stat-figure text-base-content/50"><Monitor size={22} aria-hidden="true" /></div>
			<div class="stat-title">Offline</div>
			<div class="stat-value text-2xl tabular-nums">{offlineCount}</div>
			<div class="stat-desc">Accepted devices</div>
		</div>
		<div class="stat py-3">
			<div class="stat-figure text-warning"><Monitor size={22} aria-hidden="true" /></div>
			<div class="stat-title">Disabled</div>
			<div class="stat-value text-warning text-2xl tabular-nums">{disabledCount}</div>
			<div class="stat-desc">Paused access</div>
		</div>
		{#if canManage}
			<div class="stat py-3">
				<div class="stat-figure text-accent"><Inbox size={22} aria-hidden="true" /></div>
				<div class="stat-title">Pending</div>
				<div class="stat-value text-accent text-2xl tabular-nums">{pendingCount}</div>
				<div class="stat-desc">Device requests</div>
			</div>
		{/if}
		<div class="stat py-3">
			<div class="stat-figure text-secondary"><Users size={22} aria-hidden="true" /></div>
			<div class="stat-title">Members</div>
			<div class="stat-value text-secondary text-2xl tabular-nums">{members.length}</div>
			<div class="stat-desc">
				{#if invites.length > 0}
					{invites.length} invite{invites.length === 1 ? '' : 's'} open
				{:else}
					Team access
				{/if}
			</div>
		</div>
		<div class="stat py-3">
			<div class="stat-figure text-primary"><Globe size={22} aria-hidden="true" /></div>
			<div class="stat-title">Sites</div>
			<div class="stat-value text-primary text-2xl tabular-nums">{sites.length}</div>
			<div class="stat-desc">Allowed patterns</div>
		</div>
	</div>

	<div class="mt-6 grid gap-5 lg:grid-cols-2">
		<section class="{washRecipes.washPanel} border border-ink-border/50">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h3 class="text-lg font-semibold text-primary">Recent devices</h3>
					<p class="text-sm text-base-content/65">Accepted devices. Open Devices for full list.</p>
				</div>
				<a
					class="btn btn-sm btn-ghost cursor-pointer"
					href={`/home/${params.id}/devices`}
				>
					View all <ArrowRight size={14} aria-hidden="true" />
				</a>
			</div>
			<div class="mt-4 overflow-x-auto">
				<table class={washRecipes.table}>
					<thead>
						<tr>
							<th>Actions</th>
							<th>No</th>
							<th>Name</th>
							<th>Status</th>
							<th>Last seen</th>
						</tr>
					</thead>
					<tbody>
						{#if recentDevices.length === 0}
							<tr><td colspan="5" class="text-base-content/70">No devices yet.</td></tr>
						{:else}
							{#each recentDevices as d, i (d.id)}
								{@const st = deviceStatus(d)}
								<tr>
									<td>
										<div class="tooltip tooltip-right tooltip-primary" data-tip="Open">
											<a
												class="btn btn-ghost btn-square btn-sm btn-primary cursor-pointer"
												href={`/home/${params.id}/devices/${d.id}`}
												aria-label="Open"
											>
												<ArrowRight size={16} aria-hidden="true" />
											</a>
										</div>
									</td>
									<td class="text-base-content/60 tabular-nums">{i + 1}</td>
									<td class="font-medium">{d.deviceName}</td>
									<td>
										<span class={st.class}>{st.label}</span>
										<span class="ms-1 text-xs text-base-content/55">{d.freshness}</span>
									</td>
									<td class="text-sm whitespace-nowrap">{formatShort(d.lastSeenAt)}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>

		<section class="{washRecipes.washPanel} border border-ink-border/50">
			{#if canManage}
				<div class="flex items-start justify-between gap-3">
					<div>
						<h3 class="text-lg font-semibold text-primary">Pending requests</h3>
						<p class="text-sm text-base-content/65">Approve new desktop connections here.</p>
					</div>
					<a
						class="btn btn-sm btn-ghost cursor-pointer"
						href={`/home/${params.id}/requests`}
					>
						All requests <ArrowRight size={14} aria-hidden="true" />
					</a>
				</div>
				{#if pendingRequests.length === 0}
					<p class="mt-6 text-sm text-base-content/65">No pending device requests.</p>
				{:else}
					<ul class="mt-4 divide-y divide-ink-border/40">
						{#each pendingRequests as r (r.id)}
							<li class="flex flex-wrap items-center justify-between gap-2 py-3">
								<div class="min-w-0">
									<p class="truncate font-medium">{r.deviceName ?? 'Unnamed device'}</p>
									<p class="text-xs text-base-content/55">{formatShort(r.requestedAt)}</p>
								</div>
								<button
									type="button"
									class="btn btn-sm btn-success cursor-pointer"
									disabled={busy?.startsWith(`decide:${r.id}`)}
									onclick={() => {
										approveTarget = { requestId: r.id, deviceName: '' };
										(document.getElementById('modal-approve') as HTMLDialogElement).showModal();
									}}
								>
									Approve
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				<h3 class="text-lg font-semibold text-primary">Your access</h3>
				<p class="mt-2 text-sm text-base-content/65">
					You have member access. Use Devices to monitor activity. Ask an admin for configuration
					changes.
				</p>
			{/if}

			<div class="mt-6 rounded-box border border-ink-border/40 bg-base-200/40 p-4">
				<div
					class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/55"
				>
					<KeyRound size={14} aria-hidden="true" />
					Org code
				</div>
				<p class="mt-2 break-all font-mono text-sm">
					{activeSecret?.orgNameCurrent ?? '(not generated yet)'}
				</p>
				{#if canManage}
					<a
						class="btn btn-link btn-sm mt-1 cursor-pointer px-0"
						href={`/home/${params.id}/configure`}
					>
						Manage keys and proxy
					</a>
				{/if}
			</div>
		</section>
	</div>
{/if}

<dialog id="modal-approve" class="modal">
	<div class="modal-box border border-ink-border/50">
		<h3 class="card-title text-primary font-bold">Approve device</h3>
		<p class="mt-2 text-sm text-base-content/70">Device name is required when approving.</p>
		{#if approveTarget}
			<label class="form-control mt-3" for="approve-device-name">
				<span class="label">
					<span class="label-text">
						Device name<span class="text-error align-top text-sm leading-none" aria-hidden="true"
							>*</span
						>
					</span>
				</span>
				<input
					id="approve-device-name"
					class="input input-bordered cursor-text"
					bind:value={approveTarget.deviceName}
					placeholder="Front desk iPad"
					required
				/>
			</label>
		{/if}
		<div class="modal-action">
			<form method="dialog"><button class="btn cursor-pointer" type="submit">Cancel</button></form>
			<WashSubmitButton
				type="button"
				class="btn-success"
				loading={Boolean(busy?.startsWith('decide:') && busy?.includes('APPROVE'))}
				loadingText="Approving…"
				disabled={!approveTarget?.deviceName}
				onclick={async () => {
					await approve();
					(document.getElementById('modal-approve') as HTMLDialogElement).close();
				}}
			>
				Approve
			</WashSubmitButton>
		</div>
	</div>
</dialog>
