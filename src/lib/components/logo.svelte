<script lang="ts">
	import type { SVGAttributes } from "svelte/elements";

	let { ...restProps }: SVGAttributes<SVGElement> = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 256" {...restProps}>
	<rect width="400" height="256" fill="none"></rect>
	<path
		d="M 16 192 C 140 192, 140 160, 96 116 C 52 72, 52 40, 192 40 L 256 192 L 320 40"
		fill="none"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="32"
	></path>
	<line
		x1="384"
		y1="40"
		x2="320"
		y2="192"
		fill="none"
		stroke="currentColor"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="32"
	></line>
</svg>
