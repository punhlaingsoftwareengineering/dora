<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Github } from '@lucide/svelte';
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

	let { form }: { form?: { message?: string } } = $props();

	let emailSubmitting = $state(false);
	let socialSubmitting = $state(false);
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
				<h1 class="card-title text-primary text-2xl font-bold">Sign in</h1>
				<p class="mt-1 text-sm text-base-content/60">Use your email and password to continue.</p>
			</div>
			<a
				href="/onboarding"
				class="btn btn-ghost btn-square cursor-pointer"
				aria-label="Back to home"
			>
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
			class="grid gap-4"
			use:enhance={() => {
				emailSubmitting = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						emailSubmitting = false;
					}
				};
			}}
		>
			<label class="form-control w-full" for="login-email">
				<span class="label">
					<span class="label-text">
						Email<span class="align-top text-sm leading-none text-error" aria-hidden="true">*</span>
					</span>
				</span>
				<input
					id="login-email"
					class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
					name="email"
					type="email"
					autocomplete="email"
					required
				/>
			</label>
			<label class="form-control w-full" for="login-password">
				<span class="label">
					<span class="label-text">
						Password<span class="align-top text-sm leading-none text-error" aria-hidden="true">*</span>
					</span>
				</span>
				<input
					id="login-password"
					class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</label>
			<WashSubmitButton
				class="btn-primary mt-1 w-full"
				formaction="?/signInEmail"
				loading={emailSubmitting}
				disabled={socialSubmitting}
			>
				Continue
			</WashSubmitButton>
		</form>

		<div class="flex items-center gap-3" role="separator" aria-label="or">
			<span class="h-px flex-1 bg-ink-border/35"></span>
			<span class="text-xs font-medium uppercase tracking-wide text-base-content/45">or</span>
			<span class="h-px flex-1 bg-ink-border/35"></span>
		</div>

		<form
			method="POST"
			class="grid gap-2"
			use:enhance={() => {
				socialSubmitting = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						socialSubmitting = false;
					}
				};
			}}
		>
			<input type="hidden" name="provider" value="github" />
			<input type="hidden" name="callbackURL" value="/home" />
			<WashSubmitButton
				class="btn-outline w-full border-ink-border/50"
				formaction="?/signInSocial"
				loading={socialSubmitting}
				disabled={emailSubmitting}
				loadingText="Connecting…"
			>
				<Github size={18} aria-hidden="true" />
				Continue with GitHub
			</WashSubmitButton>
		</form>

		<div
			class="flex flex-wrap items-center justify-between gap-2 border-t border-ink-border/25 pt-4 text-sm"
		>
			<a class="link link-hover text-base-content/70 cursor-pointer" href="/auth/signup"
				>Need an account? Sign up</a
			>
			<a class="link link-hover text-base-content/70 cursor-pointer" href="/auth/forget-password"
				>Forgot password?</a
			>
		</div>
	</div>
</div>
