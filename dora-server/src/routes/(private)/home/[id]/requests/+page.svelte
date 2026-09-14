<script lang="ts">
	import { CircleCheck, CircleX, Inbox, Trash2 } from '@lucide/svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';

	type Toast = { tone: 'success' | 'error'; message: string } | null;
	type RequestRow = {
		id: string;
		deviceFingerprint: string;
		requestedAt: string;
		status: string;
		deviceName: string | null;
	};

	let { params, data } = $props<{
		params: { id: string };
		data: { requests: RequestRow[] };
	}>();

	let requests = $state<RequestRow[]>([]);
	let error = $state<string | null>(null);
	let toast = $state<Toast>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let busy = $state<string | null>(null);
	let approveTarget = $state<{ requestId: string; deviceName: string } | null>(null);

	$effect(() => {
		requests = data.requests ?? [];
	});

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
		const res = await fetch(`/api/orgs/${params.id}/device-requests`);
		const json = await res.json();
		if (json.ok) requests = json.requests;
	}

	async function decide(
		requestId: string,
		decision: 'APPROVE' | 'REJECT' | 'IGNORE',
		deviceName?: string
	) {
		error = null;
		busy = `decide:${requestId}:${decision}`;
		try {
			const res = await fetch(`/api/orgs/${params.id}/device-requests/decide`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ requestId, decision, deviceName })
			});
			const json = await res.json();
			if (!json.ok) throw new Error(json.error?.message ?? 'Decision failed');
			await refresh();
			await invalidateAll();
			showToast(
				'success',
				decision === 'APPROVE'
					? 'Device approved'
					: decision === 'REJECT'
						? 'Request rejected'
						: 'Request ignored'
			);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unexpected error';
			error = message;
			showToast('error', message);
		} finally {
			busy = null;
		}
	}

	async function approve() {
		if (!approveTarget?.deviceName) return;
		await decide(approveTarget.requestId, 'APPROVE', approveTarget.deviceName);
		approveTarget = null;
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
	<p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Access</p>
	<h2 class="mt-1 text-2xl font-semibold tracking-tight text-primary">Device requests</h2>
	<p class="mt-1 text-sm text-base-content/70">
		Approve, reject, ignore, or revoke desktop connections.
	</p>
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
					<th>Device name</th>
					<th>Status</th>
					<th>Requested</th>
					<th>Fingerprint</th>
				</tr>
			</thead>
			<tbody>
				{#if requests.length === 0}
					<tr><td colspan="6" class="text-base-content/70">No requests yet.</td></tr>
				{:else}
					{#each requests as r, i (r.id)}
						<tr>
							<td>
								<div class="flex flex-wrap gap-1">
									<div class="tooltip tooltip-right tooltip-success" data-tip="Approve">
										<button
											type="button"
											class="btn btn-ghost btn-square btn-sm btn-success cursor-pointer"
											class:cursor-not-allowed={r.status !== 'PENDING' || Boolean(busy)}
											disabled={r.status !== 'PENDING' || Boolean(busy)}
											aria-label="Approve"
											onclick={() => {
												approveTarget = { requestId: r.id, deviceName: '' };
												(document.getElementById('modal-approve') as HTMLDialogElement).showModal();
											}}
										>
											<CircleCheck size={16} aria-hidden="true" />
										</button>
									</div>
									<div class="tooltip tooltip-right tooltip-warning" data-tip="Reject">
										<button
											type="button"
											class="btn btn-ghost btn-square btn-sm btn-warning cursor-pointer"
											class:cursor-not-allowed={r.status !== 'PENDING' || Boolean(busy)}
											disabled={r.status !== 'PENDING' || Boolean(busy)}
											aria-label="Reject"
											onclick={() => decide(r.id, 'REJECT')}
										>
											<CircleX size={16} aria-hidden="true" />
										</button>
									</div>
									<div class="tooltip tooltip-right tooltip-secondary" data-tip="Ignore">
										<button
											type="button"
											class="btn btn-ghost btn-square btn-sm btn-secondary cursor-pointer"
											class:cursor-not-allowed={r.status !== 'PENDING' || Boolean(busy)}
											disabled={r.status !== 'PENDING' || Boolean(busy)}
											aria-label="Ignore"
											onclick={() => decide(r.id, 'IGNORE')}
										>
											<Inbox size={16} aria-hidden="true" />
										</button>
									</div>
									{#if r.status === 'APPROVED'}
										<div class="tooltip tooltip-right tooltip-error" data-tip="Revoke">
											<button
												type="button"
												class="btn btn-ghost btn-square btn-sm btn-error cursor-pointer"
												class:cursor-not-allowed={Boolean(busy)}
												disabled={Boolean(busy)}
												aria-label="Revoke"
												onclick={() => decide(r.id, 'REJECT')}
											>
												<Trash2 size={16} aria-hidden="true" />
											</button>
										</div>
									{/if}
								</div>
							</td>
							<td class="text-base-content/60 tabular-nums">{i + 1}</td>
							<td class="font-medium">{r.deviceName ?? 'Unnamed'}</td>
							<td><span class="badge badge-outline">{r.status}</span></td>
							<td class="text-sm whitespace-nowrap">{formatShort(r.requestedAt)}</td>
							<td class="max-w-[12rem] truncate font-mono text-xs">{r.deviceFingerprint}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>

<dialog id="modal-approve" class="modal">
	<div class="modal-box border border-ink-border/50">
		<h3 class="card-title text-primary font-bold">Approve device</h3>
		<p class="mt-2 text-sm text-base-content/70">Device name is required when approving.</p>
		{#if approveTarget}
			<label class="form-control mt-3" for="approve-device-name-req">
				<span class="label">
					<span class="label-text">
						Device name<span class="text-error align-top text-sm leading-none" aria-hidden="true"
							>*</span
						>
					</span>
				</span>
				<input
					id="approve-device-name-req"
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
