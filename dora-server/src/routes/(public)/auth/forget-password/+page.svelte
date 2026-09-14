<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Mail } from '@lucide/svelte';
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

	let { data }: { data: { message?: string; success?: string } } = $props();
	let submitting = $state(false);
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
				<h1 class="card-title text-primary text-2xl font-bold">Forgot password</h1>
				<p class="mt-1 text-sm text-base-content/60">
					We will email a link so you can choose a new password.
				</p>
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
		{#if data?.success}
			<div class="alert alert-success border border-success/20">
				<span>{data.success}</span>
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
			<label class="form-control w-full" for="forget-email">
				<span class="label">
					<span class="label-text">
						Email<span class="align-top text-sm leading-none text-error" aria-hidden="true">*</span>
					</span>
				</span>
				<input
					id="forget-email"
					class="input input-bordered w-full border-ink-border/50 bg-base-100 cursor-text"
					name="email"
					type="email"
					autocomplete="email"
					required
				/>
			</label>
			<WashSubmitButton
				class="btn-primary w-full"
				formaction="?/requestReset"
				loading={submitting}
				loadingText="Sending…"
			>
				<Mail size={18} aria-hidden="true" />
				Send reset link
			</WashSubmitButton>
		</form>

		<div class="border-t border-ink-border/25 pt-4 text-sm">
			<a class="link link-hover text-base-content/70 cursor-pointer" href="/auth/login"
				>Back to login</a
			>
		</div>
	</div>
</div>
