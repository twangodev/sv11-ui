<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { AgentState } from "./types.js";

	export type OrbProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
		colors?: [string, string];
		seed?: number;
		agentState?: AgentState;
		volumeMode?: "auto" | "manual";
		manualInput?: number;
		manualOutput?: number;
		getInputVolume?: () => number;
		getOutputVolume?: () => number;
	};
</script>

<script lang="ts">
	import { Canvas } from "@threlte/core";
	import { WebGLRenderer } from "three";
	import OrbScene from "./orb-scene.svelte";
	import { cn } from "$lib/utils.js";

	let {
		colors = ["#CADCFC", "#A0B9D1"],
		seed,
		agentState = null,
		volumeMode = "auto",
		manualInput,
		manualOutput,
		getInputVolume,
		getOutputVolume,
		class: className,
		...restProps
	}: OrbProps = $props();

	// Stable per-instance fallback seed if none is passed
	const instanceSeed = Math.floor(Math.random() * 2 ** 32);
	const resolvedSeed = $derived(seed ?? instanceSeed);
</script>

<div data-slot="orb" class={cn("relative h-full w-full", className)} {...restProps}>
	<Canvas
		createRenderer={(canvas) =>
			new WebGLRenderer({
				canvas,
				alpha: true,
				antialias: true,
				premultipliedAlpha: true,
			})}
	>
		<OrbScene
			{colors}
			seed={resolvedSeed}
			{agentState}
			{volumeMode}
			{manualInput}
			{manualOutput}
			{getInputVolume}
			{getOutputVolume}
		/>
	</Canvas>
</div>
