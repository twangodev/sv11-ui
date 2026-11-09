<script lang="ts">
	let { active = false, connected = false }: { active?: boolean; connected?: boolean } = $props();
	const layers = [
		{
			class: "absolute bottom-0 left-1/2 -translate-x-1/2",
			style:
				"width: 130%; height: 20vh; background: radial-gradient(ellipse 100% 100% at 50% 100%, rgba(34, 211, 238, 0.5) 0%, rgba(168, 85, 247, 0.4) 35%, rgba(251, 146, 60, 0.5) 70%, transparent 100%); filter: blur(80px)",
		},
		{
			class: "absolute bottom-0 left-1/2 -translate-x-1/2 animate-pulse",
			style:
				"width: 100%; height: 18vh; background: radial-gradient(ellipse 100% 100% at 50% 100%, rgba(134, 239, 172, 0.5) 0%, rgba(192, 132, 252, 0.4) 50%, transparent 100%); filter: blur(60px); animation-duration: 4s",
		},
		{
			class: "absolute bottom-0 left-0",
			style:
				"width: 25vw; height: 30vh; background: radial-gradient(circle at 0% 100%, rgba(34, 211, 238, 0.5) 0%, rgba(134, 239, 172, 0.3) 30%, transparent 60%); filter: blur(70px)",
		},
		{
			class: "absolute bottom-0 -left-8",
			style:
				"width: 20vw; height: 45vh; background: radial-gradient(ellipse 50% 100% at 10% 100%, rgba(34, 211, 238, 0.4) 0%, rgba(134, 239, 172, 0.25) 25%, transparent 60%); filter: blur(60px); animation: pulseGlow 5s ease-in-out infinite alternate",
		},
		{
			class: "absolute right-0 bottom-0",
			style:
				"width: 25vw; height: 30vh; background: radial-gradient(circle at 100% 100%, rgba(251, 146, 60, 0.5) 0%, rgba(251, 146, 60, 0.3) 30%, transparent 60%); filter: blur(70px)",
		},
		{
			class: "absolute -right-8 bottom-0",
			style:
				"width: 20vw; height: 45vh; background: radial-gradient(ellipse 50% 100% at 90% 100%, rgba(251, 146, 60, 0.4) 0%, rgba(192, 132, 252, 0.25) 25%, transparent 60%); filter: blur(60px); animation: pulseGlow 5s ease-in-out infinite alternate-reverse",
		},
		{
			class: "absolute bottom-0 left-1/2 -translate-x-1/2",
			style:
				"width: 100%; height: 15vh; background: linear-gradient(90deg, rgba(34, 211, 238, 0.3) 0%, rgba(168, 85, 247, 0.3) 30%, rgba(251, 146, 60, 0.3) 60%, rgba(134, 239, 172, 0.3) 100%); filter: blur(30px); animation: shimmer 8s linear infinite",
		},
	];
</script>

<div
	aria-hidden="true"
	class="pointer-events-none fixed inset-0 transition-opacity duration-300 ease-out"
	class:opacity-0={!active}
	class:opacity-100={active}
>
	{#each layers as layer, i (i)}
		<div class={layer.class} style={layer.style} class:opacity-80={i === 1 && !connected}></div>
	{/each}
</div>

<style>
	@keyframes -global-shimmer {
		0%,
		100% {
			transform: translateX(-20%) scale(1);
		}
		50% {
			transform: translateX(20%) scale(1.1);
		}
	}
	@keyframes -global-pulseGlow {
		0% {
			opacity: 0.5;
			transform: translateY(0) scale(1);
		}
		100% {
			opacity: 0.8;
			transform: translateY(-5%) scale(1.02);
		}
	}
</style>
