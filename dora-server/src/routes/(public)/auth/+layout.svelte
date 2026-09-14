<script lang="ts">
	let { children } = $props();
</script>

<div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
	<div class="w-full max-w-md">{@render children()}</div>
</div>
