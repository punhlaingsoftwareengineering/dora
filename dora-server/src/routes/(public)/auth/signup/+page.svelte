<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft } from '@lucide/svelte';
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import WashOtp from '$lib/ui/WashOtp.svelte';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

	type SignupView = { message?: string; stage?: 'REQUEST' | 'VERIFY'; token?: string; email?: string };
	let { data, form }: { data: SignupView; form: SignupView | null } = $props();

	let view = $derived<SignupView>(form ?? data ?? {});
	let stage = $derived<'REQUEST' | 'VERIFY'>(view.stage ?? 'REQUEST');
	let token = $state('');
	let otp = $state('');
	let submitting = $state(false);

	$effect(() => {
		token = view.token ?? '';
	});
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
				<h1 class="card-title text-primary text-2xl font-bold">
					{stage === 'REQUEST' ? 'Create account' : 'Verify email'}
				</h1>
				<p class="mt-1 text-sm text-base-content/60">
					{#if stage === 'REQUEST'}
						Enter your details. We will send a one-time code to confirm your email.
					{:else}
						Enter the 6-digit code we sent to {view.email}.
					{/if}
				</p>
			</div>
			<a
				href="/onboarding"
				class="btn btn-ghost btn-square cursor-pointer"
				aria-label="Back to home"
			>
				<ArrowLeft size={18} aria-hidden="true" />
			</a>
		</div>

		{#if view?.message}
			<div class="alert alert-error border border-error/20">
				<span>{view.message}</span>
			</div>
		{/if}

		{#if stage === 'REQUEST'}
			<form
				method="POST"
				class="grid gap-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							submitting = false;
						}
					};
				}}
			>
				<label class="form-control w-full" for="signup-name">
					<span class="label">
						<span class="label-text">
							Name<span class="align-top text-sm leading-none text-error" aria-hidden="true">*</span>
						</span>
					</span>
					<input
						id="signup-name"
						class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
						name="name"
						required
					/>
				</label>
				<label class="form-control w-full" for="signup-email">
					<span class="label">
						<span class="label-text">
							Email<span class="align-top text-sm leading-none text-error" aria-hidden="true">*</span>
						</span>
					</span>
					<input
						id="signup-email"
						class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
						name="email"
						type="email"
						autocomplete="email"
						required
					/>
				</label>
				<label class="form-control w-full" for="signup-password">
					<span class="label">
						<span class="label-text">
							Password<span class="align-top text-sm leading-none text-error" aria-hidden="true">*</span>
						</span>
					</span>
					<input
						id="signup-password"
						class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
						name="password"
						type="password"
						autocomplete="new-password"
						required
					/>
				</label>
				<label class="form-control w-full" for="signup-password-confirm">
					<span class="label">
						<span class="label-text">
							Confirm password<span
								class="align-top text-sm leading-none text-error"
								aria-hidden="true">*</span
							>
						</span>
					</span>
					<input
						id="signup-password-confirm"
						class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
						name="passwordConfirm"
						type="password"
						autocomplete="new-password"
						required
					/>
				</label>
				<WashSubmitButton
					class="btn-primary mt-1 w-full"
					formaction="?/requestOtp"
					loading={submitting}
					loadingText="Sending…"
				>
					Send verification code
				</WashSubmitButton>
			</form>
		{:else}
			<form
				method="POST"
				class="grid gap-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							submitting = false;
						}
					};
				}}
			>
				<input type="hidden" name="token" value={token} />
				<div class="form-control w-full">
					<label class="label" for="signup-otp">
						<span class="label-text">
							OTP code<span class="align-top text-sm leading-none text-error" aria-hidden="true"
								>*</span
							>
						</span>
					</label>
					<WashOtp id="signup-otp" name="otp" bind:value={otp} ariaLabel="OTP code" required />
				</div>
				<WashSubmitButton
					class="btn-primary mt-1 w-full"
					formaction="?/verifyOtp"
					loading={submitting}
					loadingText="Verifying…"
					disabled={otp.length < 6}
				>
					Verify and create account
				</WashSubmitButton>
			</form>
		{/if}

		<div
			class="flex flex-wrap items-center justify-between gap-2 border-t border-ink-border/25 pt-4 text-sm"
		>
			<a class="link link-hover text-base-content/70 cursor-pointer" href="/auth/login"
				>Already have an account? Sign in</a
			>
			<a class="link link-hover text-base-content/70 cursor-pointer" href="/auth/forget-password"
				>Forgot password?</a
			>
		</div>
	</div>
</div>
