<script lang="ts">
	import { goto } from '$app/navigation';
	import { Palette, LogIn, Sun, Moon } from '@lucide/svelte';
	import { page } from '$app/state';
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import {
		washRecipes,
		type ThemeMode,
		type WatercolorThemeId
	} from '@menzies-mariesta-com/menzies-design-wash-ui/core';
	import { WashThemeTool } from '$lib/tool/wash-theme.tool.svelte';
	import { closeDetailsOnOutside } from '$lib/attachments/close-details-on-outside';
	import { APP_VERSION } from '$lib/app-version';
	import { onMount } from 'svelte';

	const links = [
		{ href: '/onboarding', label: 'Home' },
		{ href: '/onboarding#features', label: 'Features' },
		{ href: '/onboarding#pricing', label: 'Pricing' }
	] as const;

	const washThemeTool = new WashThemeTool();
	let pigment = $state<WatercolorThemeId>('mineral');
	let mode = $state<ThemeMode>('light');
	let open = $state(false);
	const pigments = washThemeTool.listPigments();

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
</script>

<div class={washRecipes.navbar}>
	<div class="navbar-start">
		<button class="btn btn-ghost gap-2 text-xl cursor-pointer" onclick={() => goto('/onboarding')}>
			<LogoMark size={28} class="shrink-0 text-primary" />
			<span class="dora-wordmark font-display font-semibold tracking-tight">Dora</span>
			<span class="text-xs font-normal text-base-content/45 tabular-nums">v{APP_VERSION}</span>
		</button>
	</div>

	<div class="navbar-center hidden lg:flex">
		<ul class="menu menu-horizontal px-1">
			{#each links as l}
				<li>
					<a
						class="cursor-pointer {page.url.pathname.startsWith('/onboarding') ? 'active' : ''}"
						href={l.href}>{l.label}</a
					>
				</li>
			{/each}
		</ul>
	</div>

	<div class="navbar-end gap-2">
		<div class="tooltip tooltip-bottom tooltip-secondary" data-tip="Appearance">
			<details class="dropdown dropdown-end" bind:open {@attach closeDetailsOnOutside()}>
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

		<a class="btn btn-primary cursor-pointer" href="/auth/login">
			<LogIn size={18} aria-hidden="true" />
			<span class="hidden sm:inline">Login</span>
		</a>
	</div>
</div>
