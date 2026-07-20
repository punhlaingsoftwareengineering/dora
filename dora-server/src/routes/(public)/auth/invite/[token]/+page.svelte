<script lang="ts">
	let { data, form } = $props<{
		data: {
			token: string;
			email: string;
			role: string;
			orgName: string;
			status: string;
			expired: boolean;
			user: { id: string; email: string } | null;
		};
		form?: { message?: string };
	}>();
</script>

<div class="card bg-base-100 shadow max-w-lg mx-auto">
	<div class="card-body gap-4">
		<h1 class="card-title text-2xl">Organization invitation</h1>
		<p class="text-sm text-base-content/70">
			Join <span class="font-semibold">{data.orgName}</span> as <span class="badge badge-outline">{data.role}</span>
		</p>
		<p class="text-sm">Invited email: <span class="font-mono">{data.email}</span></p>

		{#if form?.message}
			<div class="alert alert-error"><span>{form.message}</span></div>
		{/if}

		{#if data.expired || data.status !== 'PENDING'}
			<div class="alert alert-warning">
				<span>This invitation is no longer valid ({data.expired ? 'expired' : data.status}).</span>
			</div>
		{:else if !data.user}
			<a class="btn btn-primary" href={`/auth/login?next=/auth/invite/${data.token}`}>Sign in to accept</a>
			<a class="btn btn-outline" href={`/auth/signup?next=/auth/invite/${data.token}`}>Create account</a>
		{:else if data.user.email.toLowerCase() !== data.email.toLowerCase()}
			<div class="alert alert-error">
				<span>Signed in as {data.user.email}, but this invite is for {data.email}.</span>
			</div>
		{:else}
			<form method="POST" action="?/accept">
				<button class="btn btn-success" type="submit">Accept invitation</button>
			</form>
		{/if}
	</div>
</div>
