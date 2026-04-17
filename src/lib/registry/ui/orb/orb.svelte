<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { OrbAgentState } from "./types.js";

	export type OrbProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
		/**
		 * Two hex colors sampled across the orb's gradient. Update reactively
		 * to animate between palettes.
		 * @default ["#CADCFC", "#A0B9D1"]
		 */
		colors?: [string, string];
		/**
		 * Seed for the orb's internal noise, determining its overall shape.
		 * Defaults to a stable per-instance random value so multiple orbs on
		 * one page look distinct.
		 */
		seed?: number;
		/**
		 * Drives the orb's visual behavior to reflect the agent lifecycle.
		 * Pass `null` to render the idle state.
		 * @default null
		 */
		agentState?: OrbAgentState;
		/**
		 * `"auto"` uses the active microphone and output audio streams to
		 * drive reactivity. `"manual"` reads `manualInput` / `manualOutput`
		 * (or the `get*Volume` callbacks) instead.
		 * @default "auto"
		 */
		volumeMode?: "auto" | "manual";
		/** Manual input volume in `[0, 1]`. Only read when `volumeMode="manual"`. */
		manualInput?: number;
		/** Manual output volume in `[0, 1]`. Only read when `volumeMode="manual"`. */
		manualOutput?: number;
		/**
		 * Called every frame to sample input volume in `[0, 1]`. Takes
		 * precedence over `manualInput` when both are provided.
		 */
		getInputVolume?: () => number;
		/**
		 * Called every frame to sample output volume in `[0, 1]`. Takes
		 * precedence over `manualOutput` when both are provided.
		 */
		getOutputVolume?: () => number;
	};
</script>

<script lang="ts">
	import { Canvas } from "@threlte/core";
	import { ACESFilmicToneMapping, WebGLRenderer } from "three";
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
		toneMapping={ACESFilmicToneMapping}
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
