<script lang="ts">
	import { Shield } from '@lucide/svelte';

	let { data, form } = $props<{
		data: { twoFactorEnabled: boolean };
		form?: {
			message?: string;
			totpURI?: string | null;
			backupCodes?: string[];
			verified?: boolean;
		};
	}>();
</script>

<div class="max-w-xl">
	<div class="flex items-start gap-3">
		<Shield size={28} />
		<div>
			<h1 class="text-2xl font-bold">Security</h1>
			<p class="text-base-content/70">
				Two-factor authentication is required for the Dora admin dashboard.
			</p>
		</div>
	</div>

	{#if form?.message}
		<div class="alert alert-error mt-4"><span>{form.message}</span></div>
	{/if}

	{#if data.twoFactorEnabled || form?.verified}
		<div class="alert alert-success mt-6">
			<span>2FA is enabled on your account. You can continue to organizations.</span>
		</div>
		<a class="btn btn-primary mt-4" href="/home">Go to organizations</a>
	{:else}
		<div class="card bg-base-100 shadow mt-6">
			<div class="card-body gap-4">
				<h2 class="card-title">Enable authenticator app</h2>
				<p class="text-sm text-base-content/70">
					Enter your password to generate a TOTP secret, then scan the URI with an authenticator app.
				</p>

				<form method="POST" action="?/enable" class="grid gap-3">
					<label class="form-control">
						<div class="label"><span class="label-text">Password (required if you signed up with email)</span></div>
						<input class="input input-bordered" type="password" name="password" />
					</label>
					<button class="btn btn-primary" type="submit">Generate TOTP</button>
				</form>

				{#if form?.totpURI}
					<div class="rounded-box bg-base-200 p-4">
						<div class="text-xs uppercase text-base-content/60">TOTP URI</div>
						<div class="font-mono text-xs break-all mt-1">{form.totpURI}</div>
					</div>
					{#if form.backupCodes?.length}
						<div class="rounded-box bg-base-200 p-4">
							<div class="text-xs uppercase text-base-content/60">Backup codes</div>
							<ul class="mt-2 font-mono text-xs space-y-1">
								{#each form.backupCodes as code}
									<li>{code}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<form method="POST" action="?/verifyTotp" class="grid gap-3">
						<label class="form-control">
							<div class="label"><span class="label-text">Authenticator code</span></div>
							<input class="input input-bordered" name="code" inputmode="numeric" required />
						</label>
						<button class="btn btn-success" type="submit">Verify & enable 2FA</button>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>
