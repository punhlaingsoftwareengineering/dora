<script lang="ts">
	import { enhance } from '$app/forms';
	import { Shield } from '@lucide/svelte';
	import WashOtp from '$lib/ui/WashOtp.svelte';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';

	let { data, form } = $props<{
		data: { twoFactorEnabled: boolean };
		form?: {
			message?: string;
			totpURI?: string | null;
			qrDataUrl?: string | null;
			manualSecret?: string | null;
			backupCodes?: string[];
			verified?: boolean;
		};
	}>();

	let enableSubmitting = $state(false);
	let verifySubmitting = $state(false);
	let totpCode = $state('');
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
		<a class="btn btn-primary mt-4 cursor-pointer" href="/home">Go to organizations</a>
	{:else}
		<div class="card bg-base-100 shadow mt-6">
			<div class="card-body gap-4">
				<h2 class="card-title text-primary font-bold">Enable authenticator app</h2>
				<p class="text-sm text-base-content/70">
					Use Google Authenticator, Microsoft Authenticator, or any TOTP app. Enter your password to
					show a QR code, scan it, then enter the 6-digit code below.
				</p>

				<form
					method="POST"
					action="?/enable"
					class="grid gap-3"
					use:enhance={() => {
						enableSubmitting = true;
						return async ({ update }) => {
							try {
								await update();
							} finally {
								enableSubmitting = false;
							}
						};
					}}
				>
					<label class="form-control" for="security-password">
						<span class="label">
							<span class="label-text">Password (required if you signed up with email)</span>
						</span>
						<input
							id="security-password"
							class="input input-bordered cursor-text"
							type="password"
							name="password"
						/>
					</label>
					<WashSubmitButton class="btn-primary" loading={enableSubmitting} loadingText="Loading…">
						Show QR code
					</WashSubmitButton>
				</form>

				{#if form?.qrDataUrl}
					<div class="flex flex-col items-center gap-3 rounded-box bg-base-200 p-6">
						<img
							src={form.qrDataUrl}
							alt="Scan this QR code with your authenticator app"
							width="240"
							height="240"
							class="rounded bg-white p-2"
						/>
						<p class="text-center text-sm text-base-content/70">
							Scan with Google Authenticator or Microsoft Authenticator
						</p>
						{#if form.manualSecret}
							<details class="w-full">
								<summary class="cursor-pointer text-sm text-base-content/70">
									Can't scan? Enter key manually
								</summary>
								<div class="mt-2 rounded-box bg-base-100 p-3 font-mono text-sm break-all tracking-wider">
									{form.manualSecret}
								</div>
							</details>
						{/if}
					</div>

					{#if form.backupCodes?.length}
						<div class="rounded-box bg-base-200 p-4">
							<div class="text-xs uppercase text-base-content/60">Backup codes</div>
							<p class="mt-1 text-xs text-base-content/70">
								Save these somewhere safe. Each code can be used once if you lose your phone.
							</p>
							<ul class="mt-2 space-y-1 font-mono text-xs">
								{#each form.backupCodes as code}
									<li>{code}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<form
						method="POST"
						action="?/verifyTotp"
						class="grid gap-3"
						use:enhance={() => {
							verifySubmitting = true;
							return async ({ update }) => {
								try {
									await update();
								} finally {
									verifySubmitting = false;
								}
							};
						}}
					>
						<div class="form-control w-full">
							<label class="label" for="security-totp">
								<span class="label-text">
									6-digit code from your app<span
										class="align-top text-sm leading-none text-error"
										aria-hidden="true">*</span
									>
								</span>
							</label>
							<WashOtp
								id="security-totp"
								name="code"
								bind:value={totpCode}
								ariaLabel="Authenticator code"
								required
							/>
						</div>
						<WashSubmitButton
							class="btn-success"
							loading={verifySubmitting}
							disabled={totpCode.length < 6}
							loadingText="Verifying…"
						>
							Verify & enable 2FA
						</WashSubmitButton>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>
