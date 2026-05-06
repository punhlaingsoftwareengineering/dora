<script lang="ts">
	import { browser } from '$app/environment';
	import { X, Minus, Plus, RefreshCw, ArrowDownToLine, LogOut } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { checkForUpdate, relaunchApp, type DownloadEvent, type UpdateHandle } from '$lib/updater';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { clearConnectCredentials, clearConnection, loadConnection } from '$lib/deviceStorage';

	let isTauri = $state(false);

	/** Only the Home screen may disconnect an approved session (not Connect setup, not `/` redirect, etc.). */
	const onHome = $derived(
		page.url.pathname === '/home' || page.url.pathname.startsWith('/home/')
	);
	const disconnectEnabled = $derived(onHome && loadConnection() !== null);

	const disconnectTooltip = $derived.by(() => {
		const path = page.url.pathname;
		if (path.startsWith('/auth/connect')) return 'Disconnect isn’t available while connecting';
		if (!(path === '/home' || path.startsWith('/home/'))) return 'Disconnect from the Home screen';
		if (loadConnection() === null) return 'No active connection';
		return 'Disconnect';
	});

	onMount(() => {
		isTauri = '__TAURI_INTERNALS__' in window;
		if (!isTauri) return;

		void checkUpdates({ showModal: false });
		const id = setInterval(() => void checkUpdates({ showModal: false }), UPDATE_POLL_MS);
		return () => clearInterval(id);
	});

	const UPDATE_POLL_MS = 10 * 60 * 1000;

	let updateState = $state<
		| { kind: 'idle' }
		| { kind: 'checking' }
		| { kind: 'none' }
		| { kind: 'available'; version: string; notes?: string; handle: UpdateHandle }
		| { kind: 'downloading'; progress: number; handle: UpdateHandle }
		| { kind: 'error'; message: string }
	>({ kind: 'idle' });

	function showUpdateModal() {
		(document.getElementById('modal-update') as HTMLDialogElement | null)?.showModal();
	}

	async function checkUpdates(opts?: { showModal?: boolean }) {
		updateState = { kind: 'checking' };
		if (opts?.showModal) showUpdateModal();
		try {
			const update = await checkForUpdate();
			if (!update) {
				updateState = { kind: 'none' };
				return;
			}
			updateState = { kind: 'available', version: update.version, notes: update.body, handle: update };
			if (opts?.showModal) showUpdateModal();
		} catch (e) {
			updateState = { kind: 'error', message: e instanceof Error ? e.message : 'Update check failed' };
			if (opts?.showModal) showUpdateModal();
		}
	}

	async function downloadAndInstall() {
		if (updateState.kind !== 'available') return;
		const handle = updateState.handle;
		updateState = { kind: 'downloading', progress: 0, handle };
		try {
			await handle.downloadAndInstall((evt: DownloadEvent) => {
				if (evt.event === 'Progress') {
					updateState = {
						kind: 'downloading',
						handle,
						progress: Math.min(95, updateState.kind === 'downloading' ? updateState.progress + 1 : 1)
					};
				}
				if (evt.event === 'Finished') updateState = { kind: 'downloading', handle, progress: 100 };
			});
			await relaunchApp();
		} catch (e) {
			updateState = { kind: 'error', message: e instanceof Error ? e.message : 'Update failed' };
		}
	}

	async function minimizeWin() {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		await getCurrentWindow().minimize();
	}

	async function toggleMaximizeWin() {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		await getCurrentWindow().toggleMaximize();
	}

	async function closeWin() {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		await getCurrentWindow().close();
	}

	async function disconnect() {
		clearConnection();
		clearConnectCredentials();
		await goto('/auth/connect');
	}

	function reloadApp() {
		window.location.reload();
	}

	function showDisconnectConfirm() {
		if (!disconnectEnabled) return;
		(document.getElementById('modal-disconnect') as HTMLDialogElement | null)?.showModal();
	}

	const updateTooltip = $derived.by(() => {
		switch (updateState.kind) {
			case 'available':
				return `Update available · ${updateState.version}`;
			case 'checking':
				return 'Checking for updates…';
			case 'downloading':
				return 'Downloading update…';
			case 'error':
				return updateState.message.length > 80
					? `${updateState.message.slice(0, 77)}…`
					: updateState.message;
			case 'none':
				return 'You’re up to date';
			default:
				return 'Check for updates';
		}
	});
</script>

{#if browser && isTauri}
	<header
		class="navbar rounded-none border-b border-base-300 bg-base-100/95 min-h-11 shrink-0 select-none px-0 backdrop-blur-sm"
		aria-label="Window title bar"
	>
		<div class="navbar-start flex flex-1 self-stretch ps-2" data-tauri-drag-region>
			<div class="flex items-center py-2 ps-1">
				<span class="text-sm font-semibold tracking-tight text-base-content/80">Dora</span>
			</div>
		</div>
		<div class="navbar-end flex-none gap-0 pe-1">
			<div class="tooltip tooltip-bottom" data-tip="Refresh">
				<button type="button" class="btn btn-ghost btn-square btn-sm" aria-label="Refresh" onclick={reloadApp}>
					<RefreshCw size={18} aria-hidden="true" />
				</button>
			</div>

			<div class="tooltip tooltip-bottom max-w-xs whitespace-normal before:z-[60] after:z-[60]" data-tip={updateTooltip}>
				<div class="indicator">
					<span
						class="indicator-item top-1 end-1 size-1.5 rounded-full bg-primary ring-2 ring-base-100"
						class:hidden={updateState.kind !== 'available'}
						aria-hidden="true"
					></span>
					<button
						type="button"
						class="btn btn-ghost btn-square btn-sm"
						aria-label={updateState.kind === 'available' ? `Update available, version ${updateState.version}` : 'Check updates'}
						onclick={() => void checkUpdates({ showModal: true })}
					>
						<ArrowDownToLine size={18} aria-hidden="true" />
					</button>
				</div>
			</div>

			<div class="tooltip tooltip-bottom" data-tip={disconnectTooltip}>
				<button
					type="button"
					class="btn btn-ghost btn-square btn-sm text-error hover:bg-error/15 disabled:text-base-content/30 disabled:hover:bg-transparent"
					aria-label={disconnectTooltip}
					disabled={!disconnectEnabled}
					onclick={showDisconnectConfirm}
				>
					<LogOut size={18} aria-hidden="true" />
				</button>
			</div>

			<div class="tooltip tooltip-bottom" data-tip="Minimize">
				<button type="button" class="btn btn-ghost btn-square btn-sm" aria-label="Minimize" onclick={() => void minimizeWin()}>
					<Minus size={18} aria-hidden="true" />
				</button>
			</div>

			<div class="tooltip tooltip-bottom" data-tip="Maximize">
				<button type="button" class="btn btn-ghost btn-square btn-sm" aria-label="Maximize" onclick={() => void toggleMaximizeWin()}>
					<Plus size={18} aria-hidden="true" />
				</button>
			</div>

			<div class="tooltip tooltip-bottom" data-tip="Close">
				<button
					type="button"
					class="btn btn-ghost btn-square btn-sm hover:bg-error/15 hover:text-error"
					aria-label="Close"
					onclick={() => void closeWin()}
				>
					<X size={18} aria-hidden="true" />
				</button>
			</div>
		</div>
	</header>

	<dialog id="modal-update" class="modal">
		<div class="modal-box rounded-2xl">
			<h3 class="text-lg font-semibold">Updates</h3>

			{#if updateState.kind === 'checking'}
				<p class="mt-2 text-sm text-base-content/70">Checking for updates…</p>
			{:else if updateState.kind === 'none'}
				<p class="mt-2 text-sm text-base-content/70">You’re up to date.</p>
			{:else if updateState.kind === 'available'}
				<p class="mt-2 text-sm text-base-content/70">
					Update available: <span class="font-mono">{updateState.version}</span>
				</p>
				{#if updateState.notes}
					<div class="mt-3 max-h-48 overflow-y-auto rounded-xl bg-base-200 p-3 text-sm whitespace-pre-wrap">
						{updateState.notes}
					</div>
				{/if}
			{:else if updateState.kind === 'downloading'}
				<p class="mt-2 text-sm text-base-content/70">Downloading and installing…</p>
				<progress class="progress progress-primary mt-3 w-full" value={updateState.progress} max="100"></progress>
			{:else if updateState.kind === 'error'}
				<div class="alert alert-error mt-3"><span>{updateState.message}</span></div>
			{/if}

			<div class="modal-action">
				<form method="dialog"><button class="btn">Close</button></form>
				{#if updateState.kind === 'available'}
					<button class="btn btn-primary" type="button" onclick={() => void downloadAndInstall()}>
						Download & install
					</button>
				{/if}
			</div>
		</div>
	</dialog>

	<dialog id="modal-disconnect" class="modal">
		<div class="modal-box rounded-2xl">
			<h3 class="text-lg font-semibold">Disconnect?</h3>
			<p class="mt-2 text-sm text-base-content/70">
				This will disconnect this device and clear the saved organization code and secret key.
			</p>
			<div class="modal-action">
				<form method="dialog"><button class="btn">Cancel</button></form>
				<button class="btn btn-error" type="button" onclick={() => void disconnect()}>Disconnect</button>
			</div>
		</div>
	</dialog>
{/if}
