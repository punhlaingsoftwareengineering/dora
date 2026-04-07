<script lang="ts">
	import { LogOut, Home, Settings } from '@lucide/svelte';
	let { data, children } = $props();
</script>

<div class="min-h-screen bg-base-200">
	<div class="navbar bg-base-100">
		<div class="navbar-start">
			<a class="btn btn-ghost text-xl" href="/home">Whitelist Browser</a>
		</div>
		<div class="navbar-center hidden lg:flex">
			<ul class="menu menu-horizontal px-1">
				<li><a href="/home"><Home size={18} />Home</a></li>
				<li><a href="/home"><Settings size={18} />Organizations</a></li>
			</ul>
		</div>
		<div class="navbar-end">
			<form method="POST" action="/api/auth/sign-out">
				<button class="btn btn-ghost" type="submit"><LogOut size={18} />Sign out</button>
			</form>
		</div>
	</div>

	<div class="mx-auto max-w-6xl p-6">
		<div class="mb-4 text-sm text-base-content/70">Signed in as {data.user.email}</div>
		{@render children()}
	</div>
</div>

