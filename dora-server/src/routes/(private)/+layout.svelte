<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { LogOut, Home, Settings, Shield, Palette, Sun, Moon } from '@lucide/svelte';
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import WashSubmitButton from '$lib/ui/WashSubmitButton.svelte';
	import { washRecipes, type ThemeMode, type WatercolorThemeId } from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import { WashThemeTool } from '$lib/tool/wash-theme.tool.svelte';
	import { closeDetailsOnOutside } from '$lib/attachments/close-details-on-outside';
	import { APP_VERSION } from '$lib/app-version';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	const washThemeTool = new WashThemeTool();
	let pigment = $state<WatercolorThemeId>('mineral');
	let mode = $state<ThemeMode>('light');
	let appearanceOpen = $state(false);
	let signingOut = $state(false);

	onMount(() => {
		pigment = washThemeTool.getPigment();
		mode = washThemeTool.getMode();
	});

	function setPigment(next: WatercolorThemeId) {
		pigment = next;
		washThemeTool.setPigment(next);
	}

	function setMode(next: ThemeMode) {
		mode = next;
		washThemeTool.setMode(next);
	}

	const pigments = washThemeTool.listPigments();

	/** Org dashboard uses its own drawer shell; skip global panel chrome there. */
	const isOrgShell = $derived(/^\/home\/[^/]+/.test(page.url.pathname) && page.url.pathname !== '/home/security');
</script>

<div class="flex min-h-screen flex-col">
	<div class={washRecipes.navbar}>
		<div class="navbar-start">
			<a class="btn btn-ghost gap-2 text-xl cursor-pointer" href={resolve('/home')}>
				<LogoMark size={28} class="shrink-0" />
				<span class="dora-wordmark font-display font-semibold tracking-tight">Dora</span>
				<span class="text-xs font-normal text-base-content/45 tabular-nums">v{APP_VERSION}</span>
			</a>
		</div>
		<div class="navbar-center hidden lg:flex">
			<ul class="menu menu-horizontal px-1">
				<li>
					<a class="cursor-pointer" href={resolve('/home')}><Home size={18} />Home</a>
				</li>
				<li>
					<a class="cursor-pointer" href={resolve('/home')}><Settings size={18} />Organizations</a>
				</li>
				<li>
					<a class="cursor-pointer" href={resolve('/home/security')}><Shield size={18} />Security</a>
				</li>
			</ul>
		</div>
		<div class="navbar-end gap-1">
			<div class="tooltip tooltip-bottom tooltip-secondary" data-tip="Appearance">
				<details
					class="dropdown dropdown-end"
					bind:open={appearanceOpen}
					{@attach closeDetailsOnOutside()}
				>
					<summary
						class="btn btn-ghost btn-square btn-secondary cursor-pointer"
						aria-label="Appearance"
					>
						<Palette size={18} aria-hidden="true" />
					</summary>
					<div
						class="dropdown-content z-[60] mt-2 w-72 rounded-box border border-ink-border bg-base-100 p-3 shadow-lg"
					>
						<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
							Mode
						</p>
						<div class="join mb-3 w-full">
							<button
								type="button"
								class="btn join-item flex-1 cursor-pointer"
								class:btn-primary={mode === 'light'}
								onclick={() => setMode('light')}
							>
								<Sun size={16} aria-hidden="true" />
								Light
							</button>
							<button
								type="button"
								class="btn join-item flex-1 cursor-pointer"
								class:btn-primary={mode === 'dark'}
								onclick={() => setMode('dark')}
							>
								<Moon size={16} aria-hidden="true" />
								Dark
							</button>
						</div>
						<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
							Themes
						</p>
						<div class="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pe-1">
							{#each pigments as p (p.id)}
								<button
									type="button"
									class="btn btn-sm cursor-pointer capitalize"
									class:btn-primary={pigment === p.id}
									class:btn-ghost={pigment !== p.id}
									onclick={() => setPigment(p.id)}
								>
									{p.id}
								</button>
							{/each}
						</div>
					</div>
				</details>
			</div>

			<form
				method="POST"
				action="/auth/sign-out"
				use:enhance={() => {
					signingOut = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							signingOut = false;
						}
					};
				}}
			>
				<WashSubmitButton class="btn-ghost" loading={signingOut} loadingText="Signing out…">
					<LogOut size={18} aria-hidden="true" />Sign out
				</WashSubmitButton>
			</form>
		</div>
	</div>

	{#if isOrgShell}
		<div class="min-h-0 flex-1">
			{@render children()}
		</div>
	{:else}
		<main class="{washRecipes.washShellMain} flex-1 py-6">
			<div class="mb-4 text-sm text-base-content/70">Signed in as {data.user.email}</div>
			<div class={washRecipes.washPanel}>
				{@render children()}
			</div>
		</main>
	{/if}
</div>
