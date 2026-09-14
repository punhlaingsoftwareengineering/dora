<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, KeyRound } from '@lucide/svelte';
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

	let { data }: { data: { message?: string; token?: string } } = $props();

	let token = $state('');
	let submitting = $state(false);

	$effect(() => {
		token = data?.token ?? '';
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
				<h1 class="card-title text-primary text-2xl font-bold">Reset password</h1>
				<p class="mt-1 text-sm text-base-content/60">Choose a new password for your account.</p>
			</div>
			<a
				href="/auth/login"
				class="btn btn-ghost btn-square cursor-pointer"
				aria-label="Back to login"
			>
				<ArrowLeft size={18} aria-hidden="true" />
			</a>
		</div>

		{#if data?.message}
			<div class="alert alert-error border border-error/20">
				<span>{data.message}</span>
			</div>
		{/if}

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
			<label class="form-control w-full" for="reset-token">
				<span class="label">
					<span class="label-text">
						Reset token<span class="align-top text-sm leading-none text-error" aria-hidden="true"
							>*</span
						>
					</span>
				</span>
				<input
					id="reset-token"
					class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
					name="token"
					bind:value={token}
					required
				/>
				<span class="label">
					<span class="label-text-alt text-base-content/50">Paste the token from the reset link.</span>
				</span>
			</label>
			<label class="form-control w-full" for="reset-password">
				<span class="label">
					<span class="label-text">
						New password<span class="align-top text-sm leading-none text-error" aria-hidden="true"
							>*</span
						>
					</span>
				</span>
				<input
					id="reset-password"
					class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
					name="newPassword"
					type="password"
					autocomplete="new-password"
					required
				/>
			</label>
			<label class="form-control w-full" for="reset-password-confirm">
				<span class="label">
					<span class="label-text">
						Confirm new password<span
							class="align-top text-sm leading-none text-error"
							aria-hidden="true">*</span
						>
					</span>
				</span>
				<input
					id="reset-password-confirm"
					class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
					name="newPasswordConfirm"
					type="password"
					autocomplete="new-password"
					required
				/>
			</label>
			<WashSubmitButton
				class="btn-primary w-full"
				formaction="?/reset"
				loading={submitting}
				loadingText="Saving…"
			>
				<KeyRound size={18} aria-hidden="true" />
				Set new password
			</WashSubmitButton>
		</form>

		<div class="border-t border-ink-border/25 pt-4 text-sm">
			<a class="link link-hover text-base-content/70 cursor-pointer" href="/auth/login"
				>Back to login</a
			>
		</div>
	</div>
</div>
