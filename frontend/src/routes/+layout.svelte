<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="main-nav">
	<a href="/" class:active={$page.url.pathname === '/'}>
		Collaboration History
	</a>
	<a href="/optimize" class:active={$page.url.pathname === '/optimize'}>
		Optimize Teams
	</a>
</nav>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
		background: #f5f5f5;
	}

	.main-nav {
		background: #1a1a1a;
		padding: 0;
		display: flex;
		gap: 0;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.main-nav a {
		color: #e0e0e0;
		text-decoration: none;
		padding: 18px 30px;
		transition: background 0.2s, color 0.2s;
		border-bottom: 3px solid transparent;
	}

	.main-nav a:hover {
		background: #2a2a2a;
		color: white;
	}

	.main-nav a.active {
		background: #333;
		color: white;
		border-bottom-color: #007bff;
	}
</style>
