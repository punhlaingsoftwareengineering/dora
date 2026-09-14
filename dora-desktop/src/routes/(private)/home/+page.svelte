<script lang="ts">
	import { onMount } from 'svelte';
	import { getDeviceOptions, getResolvedServerOrigin } from '$lib/api';
	import { loadConfig } from '$lib/deviceStorage';
	import { loadConnection } from '$lib/deviceStorage';
	import { saveConfig } from '$lib/deviceStorage';
	import { clearConnection } from '$lib/deviceStorage';
	import { isAllowed as isAllowedPattern } from '$lib/allowlist';
	import { openBrowserWindow } from '$lib/tauriBrowser';
	import SiteBrandIcon from '$lib/ui/SiteBrandIcon.svelte';
	import { goto } from '$app/navigation';
	import { getVersion } from '@tauri-apps/api/app';
	import { invoke } from '@tauri-apps/api/core';

	let cfg = $state<ReturnType<typeof loadConfig>>(null);
	let current = $state<string | null>(null);
	let uiError = $state<string | null>(null);
	let deviceSpec = $state<{
		hostname?: string;
		username?: string;
		os?: string;
		os_version?: string;
		arch?: string;
	} | null>(null);
	let hasConnection = $state(false);
	let configVersion = $state<number | null>(null);
	let sendTelemetry: (() => Promise<void>) | null = null;

	onMount(() => {
		cfg = loadConfig();
		// No built-in default sites: allowlist is fully server/admin driven.
		current = cfg?.sites?.[0] ? patternToStartUrl(cfg.sites[0].urlPattern) : null;

		const conn = loadConnection();
		hasConnection = !!conn;
		if (!conn) return;

		// Best-effort: collect richer device info from Tauri backend.
		invoke('get_device_spec')
			.then((spec) => {
				deviceSpec = spec as any;
			})
			.catch(() => {
				deviceSpec = null;
			});

		const applyOptions = (opt: Awaited<ReturnType<typeof getDeviceOptions>>) => {
			if (opt.status === 'REJECTED' || opt.status === 'IGNORED' || opt.status === 'DISABLED') {
				clearConnection();
				hasConnection = false;
				goto('/auth/connect');
				return false;
			}
			const nextVersion = opt.configVersion ?? null;
			const changed =
				configVersion === null || nextVersion === null || nextVersion !== configVersion;
			configVersion = nextVersion;
			if (changed) {
				cfg = { proxy: opt.proxy ?? null, sites: opt.sites ?? [] };
				saveConfig(cfg);
				if (!current) current = cfg.sites?.[0] ? patternToStartUrl(cfg.sites[0].urlPattern) : null;
			}
			return true;
		};

		// Refresh config from server (admin may change proxy/sites after approval).
		getDeviceOptions(conn.orgId, conn.deviceId)
			.then((opt) => {
				applyOptions(opt);
			})
			.catch(() => {
				// ignore; keep local config
			});

		const tick = async () => {
			try {
				const appVersion = await getVersion().catch(() => null);
				await fetch(`${getResolvedServerOrigin()}/api/device/telemetry`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						orgId: conn.orgId,
						deviceId: conn.deviceId,
						currentUrl: current,
						spec: {
							hostname: deviceSpec?.hostname,
							username: deviceSpec?.username,
							os: deviceSpec?.os ?? navigator.platform,
							osVersion: deviceSpec?.os_version,
							arch: deviceSpec?.arch,
							appVersion: appVersion ?? undefined,
						},
						location: {}
					})
				});
			} catch {
				// ignore
			}
		};
		sendTelemetry = tick;

		const pollOptions = async () => {
			try {
				const opt = await getDeviceOptions(conn.orgId, conn.deviceId);
				applyOptions(opt);
			} catch {
				// ignore
			}
		};

		tick();
		pollOptions();
		const telemetryId = setInterval(tick, 30_000);
		const optionsId = setInterval(pollOptions, 60_000);
		return () => {
			sendTelemetry = null;
			clearInterval(telemetryId);
			clearInterval(optionsId);
		};
	});

	function allowed(url: string) {
		if (!cfg) return false;
		return isAllowedPattern(url, cfg.sites.map((s) => s.urlPattern));
	}

	function patternToStartUrl(pattern: string) {
		// Allowlist patterns use '*' wildcards, but the embedded browser needs a concrete URL.
		// We only support trimming trailing wildcards for navigation purposes.
		const trimmed = pattern.replace(/\*+$/g, '');
		try {
			return new URL(trimmed).toString();
		} catch {
			return trimmed;
		}
	}

	function open(url: string) {
		uiError = null;
		if (!allowed(url)) {
			uiError = 'Blocked navigation (not on your allowed sites).';
			return;
		}
		current = url;
		void sendTelemetry?.();
		const siteLabel =
			cfg?.sites.find((s) => patternToStartUrl(s.urlPattern) === url)?.label ??
			new URL(url).hostname.replace(/^www\./, '');
		const title = `${siteLabel} - Dora`;

		openBrowserWindow(url, title, cfg?.proxy ?? null, cfg?.sites.map((s) => s.urlPattern) ?? []).catch(
			(e) => {
				uiError = e instanceof Error ? e.message : 'Failed to open browser window';
			}
		);
	}

</script>

<div class="space-y-8">
	{#if uiError}
		<div class="alert alert-error rounded-xl"><span>{uiError}</span></div>
	{/if}

	{#if !cfg}
		<div class="wash-panel paper-grain border border-ink-border/50 bg-base-100/90 p-8 text-center shadow-sm">
			<p class="text-sm text-base-content/65">No config yet. Use Connect if you were signed out.</p>
		</div>
	{:else if cfg.sites.length === 0}
		<div class="wash-panel paper-grain border border-ink-border/50 bg-base-100/90 p-8 text-center shadow-sm">
			<p class="text-sm text-base-content/65">No allowed sites for this organization yet.</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each cfg.sites as s (s.id)}
				<button
					type="button"
					class="group wash-panel paper-grain cursor-pointer border border-ink-border/40 bg-base-100/90 p-0 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
					onclick={() => open(patternToStartUrl(s.urlPattern))}
				>
					<div class="p-4 sm:p-5">
						<div class="flex items-center gap-3">
							<SiteBrandIcon urlPattern={s.urlPattern} size={32} class="size-8 shrink-0" />

							<div class="min-w-0 text-left">
								<div class="truncate text-base font-semibold tracking-tight group-hover:text-primary sm:text-lg">
									{s.label}
								</div>
								<div class="truncate text-xs text-base-content/55">
									{(() => {
										try {
											return new URL(patternToStartUrl(s.urlPattern)).hostname.replace(/^www\./, '');
										} catch {
											return patternToStartUrl(s.urlPattern);
										}
									})()}
								</div>
							</div>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

