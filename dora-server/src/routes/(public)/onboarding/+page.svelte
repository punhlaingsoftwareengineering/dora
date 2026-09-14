<script lang="ts">
	import LogoMark from '$lib/ui/LogoMark.svelte';
	import { ShieldCheck, Network, Globe } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Dora: Controlled browsing for organizations</title>
	<meta
		name="description"
		content="Approve devices, enforce proxy settings, and allow only the websites your organization needs. Dora gives admins calm, precise control."
	/>
</svelte:head>

<!-- Full-bleed: no wash-shell-main / content max-width shell -->
<section
	class="dora-hero relative flex min-h-[calc(100dvh-4.5rem)] w-full flex-col justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20 lg:px-12 xl:px-16"
	aria-labelledby="dora-brand"
>
	<div class="dora-hero-glow pointer-events-none absolute inset-0" aria-hidden="true"></div>

	<div
		class="relative z-10 grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-20"
	>
		<div class="dora-reveal w-full min-w-0">
			<div class="mb-6 flex items-center gap-3">
				<LogoMark size={44} class="shrink-0 text-primary" />
				<p id="dora-brand" class="dora-brand dora-wordmark font-display font-semibold tracking-tight">
					Dora
				</p>
			</div>
			<h1
				class="font-display text-3xl font-semibold leading-[1.15] tracking-tight text-base-content sm:text-4xl lg:text-5xl"
			>
				Browsing your organization can trust.
			</h1>
			<p class="mt-5 max-w-xl text-base leading-relaxed text-base-content/70 sm:text-lg">
				Approve every device, set the proxy, and allow only the sites that matter.
			</p>
			<div class="mt-8 flex flex-wrap items-center gap-3">
				<a class="btn btn-primary btn-lg cursor-pointer" href="/auth/signup">Get started</a>
				<a class="btn btn-ghost btn-lg cursor-pointer" href="/auth/login">Sign in</a>
			</div>
		</div>

		<div class="dora-reveal dora-reveal-delay relative w-full min-w-0" aria-hidden="true">
			<svg
				class="h-auto w-full text-primary"
				viewBox="0 0 520 400"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				role="img"
			>
				<title>Illustration of controlled device access</title>
				<rect
					x="48"
					y="56"
					width="424"
					height="288"
					rx="20"
					class="stroke-ink-border fill-base-100/80"
					stroke-width="1.5"
				/>
				<rect x="48" y="56" width="424" height="44" rx="20" class="fill-base-200/80" />
				<circle cx="76" cy="78" r="5" class="fill-error/70" />
				<circle cx="94" cy="78" r="5" class="fill-warning/70" />
				<circle cx="112" cy="78" r="5" class="fill-success/70" />
				<rect x="140" y="70" width="220" height="16" rx="8" class="fill-base-300/70" />

				<rect
					x="80"
					y="128"
					width="280"
					height="36"
					rx="10"
					class="fill-primary/10 stroke-primary/30"
					stroke-width="1"
				/>
				<circle cx="102" cy="146" r="8" class="fill-primary/80" />
				<path d="M98 146h8M102 142v8" stroke="white" stroke-width="1.5" stroke-linecap="round" />
				<text x="124" y="151" fill="currentColor" font-size="13" font-family="ui-sans-serif, system-ui">
					Allowed sites
				</text>

				<rect
					x="80"
					y="180"
					width="240"
					height="36"
					rx="10"
					class="fill-base-200/90 stroke-ink-border/50"
					stroke-width="1"
				/>
				<circle cx="102" cy="198" r="8" class="fill-base-content/25" />
				<text
					x="124"
					y="203"
					fill="currentColor"
					opacity="0.55"
					font-size="13"
					font-family="ui-sans-serif, system-ui"
				>
					Proxy enforced
				</text>

				<rect
					x="80"
					y="232"
					width="200"
					height="36"
					rx="10"
					class="fill-base-200/90 stroke-ink-border/50"
					stroke-width="1"
				/>
				<circle cx="102" cy="250" r="8" class="fill-success/70" />
				<text
					x="124"
					y="255"
					fill="currentColor"
					opacity="0.55"
					font-size="13"
					font-family="ui-sans-serif, system-ui"
				>
					Device approved
				</text>

				<g class="dora-float">
					<rect
						x="360"
						y="160"
						width="88"
						height="120"
						rx="14"
						class="fill-base-100 stroke-primary/40"
						stroke-width="1.5"
					/>
					<rect x="372" y="176" width="64" height="72" rx="6" class="fill-primary/15" />
					<rect x="388" y="262" width="32" height="6" rx="3" class="fill-base-300" />
				</g>

				<path
					d="M360 220 H300"
					class="stroke-primary/50"
					stroke-width="1.5"
					stroke-dasharray="4 6"
				/>
			</svg>
		</div>
	</div>
</section>

<section
	id="features"
	class="w-full border-t border-ink-border/40 px-5 py-20 sm:px-8 lg:px-12 xl:px-16"
	aria-labelledby="features-heading"
>
	<div class="w-full">
		<h2
			id="features-heading"
			class="font-display text-2xl font-semibold tracking-tight text-base-content sm:text-3xl"
		>
			Quiet control. Clear boundaries.
		</h2>
		<p class="mt-3 max-w-2xl text-base text-base-content/65">
			Dora keeps the admin surface small so policy stays obvious and enforceable.
		</p>
	</div>

	<ul class="mt-12 w-full divide-y divide-ink-border/30 border-y border-ink-border/30">
		<li class="flex gap-4 py-7 sm:gap-6">
			<span class="mt-0.5 text-primary" aria-hidden="true"><ShieldCheck size={20} /></span>
			<div class="min-w-0 flex-1">
				<h3 class="text-base font-semibold text-base-content">Device approval</h3>
				<p class="mt-1 text-sm leading-relaxed text-base-content/65">
					Desktop agents request access. You approve, reject, or ignore before any config is shared.
				</p>
			</div>
		</li>
		<li class="flex gap-4 py-7 sm:gap-6">
			<span class="mt-0.5 text-primary" aria-hidden="true"><Network size={20} /></span>
			<div class="min-w-0 flex-1">
				<h3 class="text-base font-semibold text-base-content">Proxy by organization</h3>
				<p class="mt-1 text-sm leading-relaxed text-base-content/65">
					Set host and port once. Connected devices pick up the policy on the next refresh.
				</p>
			</div>
		</li>
		<li class="flex gap-4 py-7 sm:gap-6">
			<span class="mt-0.5 text-primary" aria-hidden="true"><Globe size={20} /></span>
			<div class="min-w-0 flex-1">
				<h3 class="text-base font-semibold text-base-content">Allowlisted websites</h3>
				<p class="mt-1 text-sm leading-relaxed text-base-content/65">
					Only the patterns you define can open in the Dora browser window.
				</p>
			</div>
		</li>
	</ul>
</section>

<section
	id="pricing"
	class="w-full border-t border-ink-border/40 px-5 py-20 sm:px-8 lg:px-12 xl:px-16"
	aria-labelledby="pricing-heading"
>
	<div class="w-full">
		<h2 id="pricing-heading" class="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
			Start with your team.
		</h2>
		<p class="mt-3 max-w-2xl text-base leading-relaxed text-base-content/65">
			Create an organization, invite admins, and connect the Dora desktop app when you are ready. No complex
			tiers to navigate first.
		</p>
		<div class="mt-8">
			<a class="btn btn-primary cursor-pointer" href="/auth/signup">Create an account</a>
		</div>
	</div>
</section>

<style>
	.dora-brand {
		font-size: clamp(2.5rem, 7vw, 4.25rem);
		line-height: 1;
		letter-spacing: -0.03em;
		font-family: var(--font-display, 'Fraunces', ui-serif, Georgia, serif);
		color: var(--color-base-content, #111111);
		opacity: 1;
		visibility: visible;
	}

	:global([data-theme$='-dark']) .dora-brand {
		color: var(--color-base-content, #f5f5f0);
	}

	.dora-hero-glow {
		background:
			radial-gradient(
				ellipse 90% 70% at 12% 18%,
				color-mix(in oklab, var(--color-primary, #276c8e) 16%, transparent),
				transparent 72%
			),
			radial-gradient(
				ellipse 75% 60% at 88% 78%,
				color-mix(in oklab, var(--color-secondary, #8a6a4a) 10%, transparent),
				transparent 70%
			);
	}

	.dora-reveal {
		/* Transform only so brand/text never sticks at opacity 0 */
		animation: dora-rise 0.7s ease-out both;
	}

	.dora-reveal-delay {
		animation-delay: 0.12s;
	}

	.dora-float {
		animation: dora-float 5.5s ease-in-out infinite;
	}

	@keyframes dora-rise {
		from {
			transform: translateY(0.75rem);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes dora-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dora-reveal,
		.dora-reveal-delay,
		.dora-float {
			animation: none;
		}
	}
</style>
