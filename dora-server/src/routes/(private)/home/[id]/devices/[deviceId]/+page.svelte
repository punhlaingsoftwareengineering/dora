<script lang="ts">
	import { onMount } from 'svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

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
	<div class="{washRecipes.alertSoft('error')}"><span>Device not found.</span></div>
{:else}
	{#if error}
		<div class="{washRecipes.alertSoft('error')} mb-4"><span>{error}</span></div>
	{/if}

	<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0">
			<p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Device</p>
			<h2 class="mt-1 truncate text-2xl font-semibold tracking-tight text-primary">{device.deviceName}</h2>
			<p class="mt-1 break-all font-mono text-xs text-base-content/70">{device.deviceFingerprint}</p>
			<div class="mt-2 flex flex-wrap items-center gap-2">
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
		<div class="flex flex-wrap gap-2">
			{#if canManage}
				{#if device.statusCode === 'DISABLED'}
					<button class="btn btn-sm cursor-pointer" type="button" onclick={() => patch({ enabled: true })}
						>Enable</button
					>
				{:else}
					<button
						class="btn btn-sm btn-warning cursor-pointer"
						type="button"
						onclick={() => patch({ enabled: false })}>Disable</button
					>
				{/if}
				<button
					class="btn btn-sm cursor-pointer"
					type="button"
					onclick={() => patch({ action: 'force_refresh' })}
				>
					Force refresh
				</button>
			{/if}
			<a class="btn btn-ghost btn-sm cursor-pointer" href={`/home/${params.id}/devices`}>Devices</a>
		</div>
	</header>

	<div class="mt-4 rounded-box border border-primary/20 bg-primary/10 p-4">
		<div class="text-xs uppercase text-base-content/60">Live URL</div>
		<div class="mt-1 break-all font-mono text-sm">{liveUrl ?? device.lastCurrentUrl ?? '-'}</div>
	</div>

	<div class="mt-6 grid gap-5 lg:grid-cols-2">
		<section class="{washRecipes.washPanel} border border-ink-border/50">
			<h3 class="text-lg font-semibold text-primary">Last seen</h3>
			<div class="mt-2 text-sm">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '-'}</div>
			<div class="mt-3">
				<div class="text-xs uppercase text-base-content/60">IP</div>
				<div class="font-mono text-xs">{device.lastIp ?? '-'}</div>
			</div>
			<div class="mt-3">
				<div class="text-xs uppercase text-base-content/60">App version</div>
				<div class="font-mono text-xs">{device.lastAppVersion ?? '-'}</div>
			</div>
		</section>

		<section class="{washRecipes.washPanel} border border-ink-border/50">
			<h3 class="text-lg font-semibold text-primary">Activity (24h)</h3>
			{#if charts}
				<p class="mt-1 text-sm text-base-content/70">{charts.eventCount24h} events</p>
				<div class="mt-3 flex h-24 items-end gap-1">
					{#each charts.eventsByHour as count, hour}
						<div
							class="flex-1 rounded-t bg-primary/70"
							style={`height: ${Math.max(4, (count / maxHour) * 100)}%`}
							title={`${hour}:00 (${count})`}
						></div>
					{/each}
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each Object.entries(charts.eventTypeCounts) as [type, count]}
						<span class="badge badge-outline">{type}: {count}</span>
					{/each}
				</div>
			{:else}
				<p class="mt-2 text-sm text-base-content/70">No chart data.</p>
			{/if}
		</section>

		<section class="{washRecipes.washPanel} border border-ink-border/50">
			<h3 class="text-lg font-semibold text-primary">Location</h3>
			<pre class="mt-2 overflow-auto rounded-box bg-base-200/60 p-3 text-xs">{JSON.stringify(device.lastLocation ?? {}, null, 2)}</pre>
		</section>

		<section class="{washRecipes.washPanel} border border-ink-border/50">
			<h3 class="text-lg font-semibold text-primary">Device specification</h3>
			<pre class="mt-2 overflow-auto rounded-box bg-base-200/60 p-3 text-xs">{JSON.stringify(device.lastSpec ?? {}, null, 2)}</pre>
		</section>

		<section class="{washRecipes.washPanel} border border-ink-border/50 lg:col-span-2">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h3 class="text-lg font-semibold text-primary">Event timeline</h3>
				<select class="select select-bordered select-sm cursor-pointer" bind:value={filterType}>
					<option value="all">All types</option>
					{#each eventTypes as t}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</div>
			<div class="mt-2 overflow-x-auto">
				<table class={washRecipes.table}>
					<thead>
						<tr>
							<th>No</th>
							<th>Time</th>
							<th>Type</th>
							<th>Payload</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as e, i (e.id)}
							<tr>
								<td class="text-base-content/60 tabular-nums">{i + 1}</td>
								<td class="whitespace-nowrap text-sm">{new Date(e.createdAt).toLocaleString()}</td>
								<td><span class="badge badge-outline">{e.eventType}</span></td>
								<td
									><pre class="max-w-[70vw] overflow-auto text-xs">{JSON.stringify(e.payload, null, 2)}</pre
									></td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>
{/if}
