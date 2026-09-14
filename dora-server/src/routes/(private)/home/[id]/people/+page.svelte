<script lang="ts">
	import { CircleCheck, CircleX, Trash2, Users } from '@lucide/svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';

	type Toast = { tone: 'success' | 'error'; message: string } | null;
	type MemberRow = {
		id: string;
		userId: string;
		role: string;
		email: string;
		name: string;
	};
	type InviteRow = {
		id: string;
		email: string;
		role: string;
		expiresAt: string;
		createdAt: string;
	};

	let { params, data } = $props<{
		params: { id: string };
		data: {
			role: string | null;
			members: MemberRow[];
			invites: InviteRow[];
		};
	}>();

	let members = $state<MemberRow[]>([]);
	let invites = $state<InviteRow[]>([]);
	let error = $state<string | null>(null);
	let toast = $state<Toast>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	let busy = $state<string | null>(null);
	let inviteEmail = $state('');
	let inviteRole = $state<'admin' | 'member'>('member');

	$effect(() => {
		members = data.members ?? [];
		invites = data.invites ?? [];
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
		const memRes = await fetch(`/api/orgs/${params.id}/members`);
		const memJson = await memRes.json();
		if (memJson.ok) {
			members = memJson.members ?? [];
			invites = (memJson.invites ?? []).map((i: Record<string, unknown>) => ({
				id: String(i.id),
				email: String(i.email),
				role: String(i.role),
				expiresAt:
					typeof i.expiresAt === 'string'
						? i.expiresAt
						: new Date(i.expiresAt as string | number | Date).toISOString(),
				createdAt:
					typeof i.createdAt === 'string'
						? i.createdAt
						: new Date(i.createdAt as string | number | Date).toISOString()
			}));
		}
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

	async function sendInvite() {
		await withBusy(
			'sendInvite',
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/members`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ email: inviteEmail, role: inviteRole })
				});
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Invite failed');
				inviteEmail = '';
				await refresh();
			},
			'Invite sent'
		);
	}

	async function revokeInvite(inviteId: string) {
		await withBusy(
			`revokeInvite:${inviteId}`,
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/invites/${inviteId}`, {
					method: 'DELETE'
				});
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Revoke failed');
				await refresh();
			},
			'Invite revoked'
		);
	}

	async function removeMember(memberId: string) {
		await withBusy(
			`removeMember:${memberId}`,
			async () => {
				const res = await fetch(`/api/orgs/${params.id}/members/${memberId}`, {
					method: 'DELETE'
				});
				const json = await res.json();
				if (!json.ok) throw new Error(json.error?.message ?? 'Remove failed');
				await refresh();
			},
			'Member removed'
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
	<p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Team</p>
	<h2 class="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
		<Users size={24} aria-hidden="true" />
		People
	</h2>
	<p class="mt-1 text-sm text-base-content/70">Members and pending invites for this organization.</p>
</header>

{#if error}
	<div class="{washRecipes.alertSoft('error')} mb-4"><span>{error}</span></div>
{/if}

<section class="{washRecipes.washPanel} border border-ink-border/50">
	{#if canManage}
		<h3 class="card-title text-primary font-bold">Invite member</h3>
		<div class="mt-3 grid gap-3 lg:grid-cols-3">
			<label class="form-control lg:col-span-2" for="invite-email">
				<span class="label">
					<span class="label-text">
						Invite email<span class="text-error align-top text-sm leading-none" aria-hidden="true"
							>*</span
						>
					</span>
				</span>
				<input
					id="invite-email"
					class="input input-bordered cursor-text"
					type="email"
					bind:value={inviteEmail}
					placeholder="colleague@example.com"
					required
				/>
			</label>
			<label class="form-control" for="invite-role">
				<span class="label"><span class="label-text">Role</span></span>
				<select
					id="invite-role"
					class="select select-bordered cursor-pointer"
					bind:value={inviteRole}
				>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>
		</div>
		<div class="mt-3">
			<WashSubmitButton
				type="button"
				class="btn-primary"
				loading={busy === 'sendInvite'}
				loadingText="Sending…"
				disabled={!inviteEmail}
				onclick={sendInvite}
			>
				Send invite
			</WashSubmitButton>
		</div>
	{/if}

	<div class="mt-6 overflow-x-auto">
		<table class={washRecipes.table}>
			<thead>
				<tr>
					<th>Actions</th>
					<th>No</th>
					<th>Name</th>
					<th>Email</th>
					<th>Role</th>
				</tr>
			</thead>
			<tbody>
				{#each members as m, i (m.id)}
					<tr>
						<td>
							{#if canManage && m.role !== 'owner'}
								<div class="tooltip tooltip-right tooltip-error" data-tip="Remove">
									<button
										type="button"
										class="btn btn-ghost btn-square btn-sm btn-error cursor-pointer"
										class:cursor-not-allowed={busy === `removeMember:${m.id}`}
										disabled={busy === `removeMember:${m.id}`}
										aria-label="Remove"
										aria-busy={busy === `removeMember:${m.id}` || undefined}
										onclick={() => removeMember(m.id)}
									>
										{#if busy === `removeMember:${m.id}`}
											<span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
										{:else}
											<Trash2 size={16} aria-hidden="true" />
										{/if}
									</button>
								</div>
							{/if}
						</td>
						<td class="text-base-content/60 tabular-nums">{i + 1}</td>
						<td class="font-medium">{m.name}</td>
						<td class="font-mono text-xs">{m.email}</td>
						<td><span class="badge badge-outline capitalize">{m.role}</span></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if canManage && invites.length > 0}
		<h3 class="mt-6 font-semibold text-secondary">Pending invites</h3>
		<div class="mt-2 overflow-x-auto">
			<table class={washRecipes.table}>
				<thead>
					<tr>
						<th>Actions</th>
						<th>No</th>
						<th>Email</th>
						<th>Role</th>
						<th>Expires</th>
					</tr>
				</thead>
				<tbody>
					{#each invites as inv, i (inv.id)}
						<tr>
							<td>
								<div class="tooltip tooltip-right tooltip-error" data-tip="Revoke">
									<button
										type="button"
										class="btn btn-ghost btn-square btn-sm btn-error cursor-pointer"
										class:cursor-not-allowed={busy === `revokeInvite:${inv.id}`}
										disabled={busy === `revokeInvite:${inv.id}`}
										aria-label="Revoke"
										onclick={() => revokeInvite(inv.id)}
									>
										{#if busy === `revokeInvite:${inv.id}`}
											<span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
										{:else}
											<Trash2 size={16} aria-hidden="true" />
										{/if}
									</button>
								</div>
							</td>
							<td class="text-base-content/60 tabular-nums">{i + 1}</td>
							<td class="font-mono text-xs">{inv.email}</td>
							<td><span class="badge badge-outline capitalize">{inv.role}</span></td>
							<td class="text-sm whitespace-nowrap">{formatShort(inv.expiresAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
