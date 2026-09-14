<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import {
		LayoutDashboard,
		Monitor,
		Inbox,
		Users,
		Settings2,
		Shield,
		Menu,
		ChevronLeft
	} from '@lucide/svelte';
	import { washRecipes } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

	let { data, children } = $props();

	let drawerOpen = $state(false);

	const orgId = $derived(page.params.id ?? '');
	const pathname = $derived(page.url.pathname);
	const canManage = $derived(data.role === 'owner' || data.role === 'admin');
	const hrefOverview = $derived(`/home/${orgId}`);
	const hrefDevices = $derived(`/home/${orgId}/devices`);
	const hrefRequests = $derived(`/home/${orgId}/requests`);
	const hrefPeople = $derived(`/home/${orgId}/people`);
	const hrefConfigure = $derived(`/home/${orgId}/configure`);

	function navActive(href: string, exact = false): boolean {
		if (exact) return pathname === href || pathname === `${href}/`;
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	function closeDrawer() {
		drawerOpen = false;
	}
</script>

{#if !data.org}
	<div class="{washRecipes.washShellMain} py-6">
		<div class={washRecipes.washPanel}>
			<div class="alert"><span>Organization not found or you do not have access.</span></div>
			<a class="btn btn-ghost mt-4 cursor-pointer" href={resolve('/home')}>
				<ChevronLeft size={18} aria-hidden="true" />
				Back to organizations
			</a>
		</div>
	</div>
{:else}
	<div class="{washRecipes.drawer} min-h-[calc(100dvh-4.5rem)]">
		<input
			id="org-drawer"
			type="checkbox"
			class="drawer-toggle"
			bind:checked={drawerOpen}
		/>

		<div class="drawer-content flex min-h-0 flex-col">
			<div
				class="flex items-center gap-2 border-b border-ink-border/50 bg-base-100/80 px-3 py-2 backdrop-blur-sm lg:hidden"
			>
				<label
					for="org-drawer"
					class="btn btn-ghost btn-square cursor-pointer drawer-button"
					aria-label="Open organization menu"
				>
					<Menu size={20} aria-hidden="true" />
				</label>
				<div class="min-w-0 flex-1">
					<p class="truncate font-display text-base font-semibold tracking-tight">
						{data.org.name}
					</p>
					<p class="text-xs capitalize text-base-content/55">{data.role}</p>
				</div>
			</div>

			<div class="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
				{@render children()}
			</div>
		</div>

		<div class="drawer-side z-40">
			<label for="org-drawer" aria-label="Close sidebar" class="drawer-overlay cursor-pointer"
			></label>
			<aside
				class="flex min-h-full w-72 flex-col border-e border-ink-border/60 bg-base-100/95 text-base-content"
			>
				<div class="border-b border-ink-border/50 px-4 py-5">
					<a
						class="mb-3 inline-flex cursor-pointer items-center gap-1 text-xs text-base-content/55 hover:text-primary"
						href={resolve('/home')}
						onclick={closeDrawer}
					>
						<ChevronLeft size={14} aria-hidden="true" />
						Organizations
					</a>
					<p class="text-xs font-semibold uppercase tracking-wide text-base-content/45">
						Organization
					</p>
					<h1 class="font-display dora-wordmark mt-1 truncate text-xl font-semibold tracking-tight">
						{data.org.name}
					</h1>
					<p class="mt-1">
						<span class="badge badge-outline badge-sm capitalize">{data.role}</span>
					</p>
				</div>

				<nav class="flex-1 overflow-y-auto p-3" aria-label="Organization">
					<ul class="menu w-full gap-0.5 rounded-box p-0">
						<li>
							<a
								class="cursor-pointer"
								class:menu-active={navActive(hrefOverview, true)}
								href={hrefOverview}
								onclick={closeDrawer}
							>
								<LayoutDashboard size={18} aria-hidden="true" />
								Overview
							</a>
						</li>
						<li>
							<a
								class="cursor-pointer"
								class:menu-active={navActive(hrefDevices)}
								href={hrefDevices}
								onclick={closeDrawer}
							>
								<Monitor size={18} aria-hidden="true" />
								Devices
							</a>
						</li>
						{#if canManage}
							<li>
								<a
									class="cursor-pointer"
									class:menu-active={navActive(hrefRequests)}
									href={hrefRequests}
									onclick={closeDrawer}
								>
									<Inbox size={18} aria-hidden="true" />
									Requests
									{#if data.pendingCount > 0}
										<span class="badge badge-accent badge-sm">{data.pendingCount}</span>
									{/if}
								</a>
							</li>
						{/if}
						<li>
							<a
								class="cursor-pointer"
								class:menu-active={navActive(hrefPeople)}
								href={hrefPeople}
								onclick={closeDrawer}
							>
								<Users size={18} aria-hidden="true" />
								People
							</a>
						</li>
						{#if canManage}
							<li>
								<a
									class="cursor-pointer"
									class:menu-active={navActive(hrefConfigure)}
									href={hrefConfigure}
									onclick={closeDrawer}
								>
									<Settings2 size={18} aria-hidden="true" />
									Configure
								</a>
							</li>
						{/if}
					</ul>

					<p
						class="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-base-content/45"
					>
						Account
					</p>
					<ul class="menu w-full gap-0.5 rounded-box p-0">
						<li>
							<a
								class="cursor-pointer"
								class:menu-active={navActive('/home/security')}
								href={resolve('/home/security')}
								onclick={closeDrawer}
							>
								<Shield size={18} aria-hidden="true" />
								Security
							</a>
						</li>
					</ul>
				</nav>

				<div class="border-t border-ink-border/50 p-4 text-xs text-base-content/50">
					Calm ops dashboard for devices, access, and connection settings.
				</div>
			</aside>
		</div>
	</div>
{/if}
