<script lang="ts">
	let { data, form } = $props<{
		data: {
			token: string;
			email: string;
			role: string;
			orgName: string;
			status: string;
			expired: boolean;
			accountExists: boolean;
			user: { id: string; email: string } | null;
		};
		form?: { message?: string };
	}>();

	const matchingUser = $derived(
		Boolean(data.user && data.user.email.toLowerCase() === data.email.toLowerCase())
	);
</script>

<div class="card mx-auto max-w-lg bg-base-100/90 shadow-md wash-panel paper-grain">
	<div class="card-body gap-4">
		<h1 class="card-title text-primary text-2xl font-bold">Organization invitation</h1>
		<p class="text-sm text-base-content/70">
			Join <span class="font-semibold">{data.orgName}</span> as
			<span class="badge badge-outline">{data.role}</span>
		</p>
		<p class="text-sm">
			Invited email: <span class="font-mono">{data.email}</span>
		</p>

		{#if form?.message}
			<div class="alert alert-error"><span>{form.message}</span></div>
		{/if}

		{#if data.expired || data.status !== 'PENDING'}
			<div class="alert alert-warning">
				<span>This invitation is no longer valid ({data.expired ? 'expired' : data.status}).</span>
			</div>
		{:else if matchingUser}
			<form method="POST" action="?/accept">
				<button class="btn btn-success" type="submit">Accept invitation</button>
			</form>
		{:else if data.user}
			<div class="alert alert-error">
				<span>Signed in as {data.user.email}, but this invite is for {data.email}. Sign out and open the invite link again.</span>
			</div>
		{:else}
			<p class="text-sm text-base-content/70">
				{#if data.accountExists}
					Enter your password to join this organization.
				{:else}
					Create a password to join. No separate sign-up is needed — your email is already set from the invite.
				{/if}
			</p>

			<form method="POST" action="?/join" class="grid gap-3">
				<label class="form-control">
					<div class="label"><span class="label-text">Email</span></div>
					<input class="input input-bordered" type="email" value={data.email} disabled />
				</label>
				<label class="form-control">
					<div class="label">
						<span class="label-text">{data.accountExists ? 'Password' : 'Create password'}</span>
					</div>
					<input
						class="input input-bordered"
						type="password"
						name="password"
						autocomplete={data.accountExists ? 'current-password' : 'new-password'}
						minlength="8"
						required
					/>
				</label>
				<label class="form-control">
					<div class="label"><span class="label-text">Confirm password</span></div>
					<input
						class="input input-bordered"
						type="password"
						name="passwordConfirm"
						autocomplete={data.accountExists ? 'current-password' : 'new-password'}
						minlength="8"
						required
					/>
				</label>
				<button class="btn btn-primary" type="submit">
					{data.accountExists ? 'Join organization' : 'Create password & join'}
				</button>
			</form>
		{/if}
	</div>
</div>
