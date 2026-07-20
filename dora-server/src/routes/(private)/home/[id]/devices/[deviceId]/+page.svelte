<script lang="ts">
	import { onMount } from 'svelte';

	type Device = {
		id: string;
		deviceName: string;
		deviceFingerprint: string;
		lastSeenAt: string | null;
		lastIp: string | null;
		lastCurrentUrl?: string | null;
		lastLocation: Record<string, unknown>;
		lastSpec: Record<string, unknown>;
		lastAppVersion: string | null;
		online?: boolean;
		freshness?: string;
		statusCode?: string;
	};

	type EventRow = { id: string; eventType: string; payload: unknown; createdAt: string };
	type Charts = {
		eventsByHour: number[];
		eventTypeCounts: Record<string, number>;
		eventCount24h: number;
	};

	let { data, params } = $props<{
		data: {
			device: Device | null;
			recent: EventRow[];
			charts: Charts | null;
			role: string | null;
		};
		params: { id: string; deviceId: string };
	}>();

	let device = $state<Device | null>(null);
	let recent = $state<EventRow[]>([]);
	let charts = $state<Charts | null>(null);
	let live = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let liveUrl = $state<string | null>(null);
	let filterType = $state<string>('all');
	let error = $state<string | null>(null);

	$effect(() => {
		device = data.device;
		recent = data.recent;
		charts = data.charts;
		liveUrl = data.device?.lastCurrentUrl ?? null;
	});

	let canManage = $derived(data.role === 'owner' || data.role === 'admin');

	let filtered = $derived(
		filterType === 'all' ? recent : recent.filter((e) => e.eventType === filterType)
	);

	let eventTypes = $derived([...new Set(recent.map((e) => e.eventType))]);

	onMount(() => {
		const es = new EventSource(`/api/orgs/${params.id}/devices/${params.deviceId}/stream`);
		es.onopen = () => (live = 'connected');
		es.onerror = () => (live = 'disconnected');
		es.onmessage = (msg) => {
			try {
				const payload = JSON.parse(msg.data) as any;
				if (payload.type === 'telemetry' || payload.type === 'heartbeat') {
					if (payload.currentUrl !== undefined) liveUrl = payload.currentUrl;
					if (device) {
						device = {
							...device,
							lastSeenAt: payload.at ?? device.lastSeenAt,
							lastIp: payload.ip ?? device.lastIp,
							lastLocation: payload.location ?? device.lastLocation,
							lastSpec: payload.spec ?? device.lastSpec,
							lastAppVersion: payload.spec?.appVersion ?? device.lastAppVersion,
							lastCurrentUrl: payload.currentUrl ?? device.lastCurrentUrl,
							online: true,
							freshness: 'just now'
						};
					}
					if (payload.type === 'telemetry') {
						recent = [
							{
								id: crypto.randomUUID(),
								eventType: 'telemetry',
								payload,
								createdAt: payload.at ?? new Date().toISOString()
							},
							...recent
						].slice(0, 100);
					}
				}
			} catch {
				// ignore
			}
		};
		return () => es.close();
	});

	async function patch(body: Record<string, unknown>) {
		error = null;
		const res = await fetch(`/api/orgs/${params.id}/devices/${params.deviceId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const json = await res.json();
		if (!json.ok) {
			error = json.error?.message ?? 'Action failed';
			return;
		}
		if (json.device && device) {
			device = { ...device, ...json.device, statusCode: body.enabled === false ? 'DISABLED' : body.enabled === true ? 'ACTIVE' : device.statusCode };
		}
	}

	const maxHour = $derived(Math.max(1, ...(charts?.eventsByHour ?? [1])));
</script>

{#if !device}
	<div class="alert alert-error"><span>Device not found.</span></div>
{:else}
	{#if error}
		<div class="alert alert-error mb-4"><span>{error}</span></div>
	{/if}

	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">{device.deviceName}</h1>
			<p class="text-base-content/70 font-mono text-xs">{device.deviceFingerprint}</p>
			<div class="mt-2 flex flex-wrap gap-2 items-center">
				{#if device.statusCode === 'DISABLED'}
					<span class="badge badge-warning">disabled</span>
				{:else if device.online}
					<span class="badge badge-success">online</span>
				{:else}
					<span class="badge">offline</span>
				{/if}
				<span class="text-xs text-base-content/60">{device.freshness ?? ''}</span>
				<span class="badge badge-outline">Live: {live}</span>
			</div>
		</div>
		<div class="flex flex-col items-end gap-2">
			{#if canManage}
				<div class="join">
					{#if device.statusCode === 'DISABLED'}
						<button class="btn btn-sm join-item" type="button" onclick={() => patch({ enabled: true })}>Enable</button>
					{:else}
						<button class="btn btn-sm btn-warning join-item" type="button" onclick={() => patch({ enabled: false })}>Disable</button>
					{/if}
					<button class="btn btn-sm join-item" type="button" onclick={() => patch({ action: 'force_refresh' })}>
						Force refresh
					</button>
				</div>
			{/if}
			<a class="btn" href={`/home/${params.id}/devices`}>Back to devices</a>
		</div>
	</div>

	<div class="mt-4 rounded-box bg-primary/10 border border-primary/20 p-4">
		<div class="text-xs uppercase text-base-content/60">Live URL</div>
		<div class="font-mono text-sm break-all mt-1">{liveUrl ?? device.lastCurrentUrl ?? '—'}</div>
	</div>

	<div class="mt-6 grid gap-6 lg:grid-cols-2">
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">Last seen</h2>
				<div class="text-sm">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '-'}</div>
				<div class="mt-3">
					<div class="text-xs uppercase text-base-content/60">IP</div>
					<div class="font-mono text-xs">{device.lastIp ?? '-'}</div>
				</div>
				<div class="mt-3">
					<div class="text-xs uppercase text-base-content/60">App version</div>
					<div class="font-mono text-xs">{device.lastAppVersion ?? '-'}</div>
				</div>
			</div>
		</div>

		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">Activity (24h)</h2>
				{#if charts}
					<p class="text-sm text-base-content/70">{charts.eventCount24h} events</p>
					<div class="mt-3 flex items-end gap-1 h-24">
						{#each charts.eventsByHour as count, hour}
							<div
								class="flex-1 bg-primary/70 rounded-t"
								style={`height: ${Math.max(4, (count / maxHour) * 100)}%`}
								title={`${hour}:00 — ${count}`}
							></div>
						{/each}
					</div>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each Object.entries(charts.eventTypeCounts) as [type, count]}
							<span class="badge badge-outline">{type}: {count}</span>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-base-content/70">No chart data.</p>
				{/if}
			</div>
		</div>

		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">Location</h2>
				<pre class="mt-2 rounded-box bg-base-200 p-3 text-xs overflow-auto">{JSON.stringify(device.lastLocation ?? {}, null, 2)}</pre>
			</div>
		</div>

		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title">Device specification</h2>
				<pre class="mt-2 rounded-box bg-base-200 p-3 text-xs overflow-auto">{JSON.stringify(device.lastSpec ?? {}, null, 2)}</pre>
			</div>
		</div>

		<div class="card bg-base-100 shadow lg:col-span-2">
			<div class="card-body">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="card-title">Event timeline</h2>
					<select class="select select-bordered select-sm" bind:value={filterType}>
						<option value="all">All types</option>
						{#each eventTypes as t}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</div>
				<div class="overflow-x-auto mt-2">
					<table class="table">
						<thead>
							<tr><th>#</th><th>Time</th><th>Type</th><th>Payload</th></tr>
						</thead>
						<tbody>
							{#each filtered as e, i (e.id)}
								<tr>
									<td class="text-base-content/60">{i + 1}</td>
									<td class="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
									<td><span class="badge badge-outline">{e.eventType}</span></td>
									<td><pre class="text-xs overflow-auto max-w-[70vw]">{JSON.stringify(e.payload, null, 2)}</pre></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
{/if}
