<script lang="ts">
	let { form } = $props<{ form?: { message?: string } }>();
</script>

<div class="card bg-base-100 shadow max-w-md mx-auto">
	<div class="card-body gap-4">
		<h1 class="card-title text-2xl">Two-factor verification</h1>
		<p class="text-sm text-base-content/70">Enter the code from your authenticator app to finish signing in.</p>

		{#if form?.message}
			<div class="alert alert-error"><span>{form.message}</span></div>
		{/if}

		<form method="POST" action="?/verifyTotp" class="grid gap-3">
			<label class="form-control">
				<div class="label"><span class="label-text">Authenticator code</span></div>
				<input class="input input-bordered" name="code" inputmode="numeric" autocomplete="one-time-code" required />
			</label>
			<button class="btn btn-primary" type="submit">Verify</button>
		</form>

		<div class="divider">or use a backup code</div>

		<form method="POST" action="?/verifyBackup" class="grid gap-3">
			<label class="form-control">
				<div class="label"><span class="label-text">Backup code</span></div>
				<input class="input input-bordered" name="code" required />
			</label>
			<button class="btn btn-outline" type="submit">Verify backup code</button>
		</form>
	</div>
</div>
