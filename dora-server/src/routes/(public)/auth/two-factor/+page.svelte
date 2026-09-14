<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft } from '@lucide/svelte';
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import WashOtp from '$lib/ui/WashOtp.svelte';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

	let { form }: { form?: { message?: string } } = $props();

	let totpCode = $state('');
	let totpSubmitting = $state(false);
	let backupSubmitting = $state(false);
</script>

<div class="{washRecipes.washPanel} w-full border border-ink-border/50 bg-base-100/85 shadow-sm">
	<div class="flex flex-col gap-6">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<a
					href="/onboarding"
					class="mb-4 inline-flex items-center gap-2 text-base-content cursor-pointer"
				>
					<LogoMark size={28} class="text-primary" />
					<span class="dora-wordmark font-display text-lg font-semibold tracking-tight">Dora</span>
				</a>
				<h1 class="card-title text-primary text-2xl font-bold">Two-factor verification</h1>
				<p class="mt-1 text-sm text-base-content/60">
					Enter the code from your authenticator app to finish signing in.
				</p>
			</div>
			<a href="/auth/login" class="btn btn-ghost btn-square cursor-pointer" aria-label="Back to login">
				<ArrowLeft size={18} aria-hidden="true" />
			</a>
		</div>

		{#if form?.message}
			<div class="alert alert-error border border-error/20">
				<span>{form.message}</span>
			</div>
		{/if}

		<form
			method="POST"
			action="?/verifyTotp"
			class="grid gap-4"
			use:enhance={() => {
				totpSubmitting = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						totpSubmitting = false;
					}
				};
			}}
		>
			<div class="form-control w-full">
				<label class="label" for="totp-code">
					<span class="label-text">
						Authenticator code<span
							class="align-top text-sm leading-none text-error"
							aria-hidden="true">*</span
						>
					</span>
				</label>
				<WashOtp
					id="totp-code"
					name="code"
					bind:value={totpCode}
					ariaLabel="Authenticator code"
					required
				/>
			</div>
			<WashSubmitButton
				class="btn-primary w-full"
				loading={totpSubmitting}
				disabled={backupSubmitting || totpCode.length < 6}
				loadingText="Verifying…"
			>
				Verify
			</WashSubmitButton>
		</form>

		<div class="flex items-center gap-3" role="separator" aria-label="or use a backup code">
			<span class="h-px flex-1 bg-ink-border/35"></span>
			<span class="text-xs font-medium uppercase tracking-wide text-base-content/45"
				>or backup code</span
			>
			<span class="h-px flex-1 bg-ink-border/35"></span>
		</div>

		<form
			method="POST"
			action="?/verifyBackup"
			class="grid gap-4"
			use:enhance={() => {
				backupSubmitting = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						backupSubmitting = false;
					}
				};
			}}
		>
			<label class="form-control w-full" for="backup-code">
				<span class="label">
					<span class="label-text">
						Backup code<span class="align-top text-sm leading-none text-error" aria-hidden="true"
							>*</span
						>
					</span>
				</span>
				<input
					id="backup-code"
					class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
					name="code"
					required
				/>
			</label>
			<WashSubmitButton
				class="btn-outline w-full border-ink-border/50"
				loading={backupSubmitting}
				disabled={totpSubmitting}
				loadingText="Verifying…"
			>
				Verify backup code
			</WashSubmitButton>
		</form>
	</div>
</div>
