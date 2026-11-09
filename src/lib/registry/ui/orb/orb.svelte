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
		/** Delay canvas resizing after container changes, in milliseconds. @default 100 */
		resizeDebounce?: number;
		/**
		 * Drives the orb's visual behavior to reflect the agent lifecycle.
		 * Pass `null` to render the idle state.
		 * @default null
		 */
		agentState?: OrbAgentState;
		/**
		 * `"auto"` animates from `agentState`. `"manual"` reads `manualInput` / `manualOutput`
		 * (or the `get*Volume` callbacks) instead.
		 * @default "auto"
		 */
		volumeMode?: "auto" | "manual";
		/** Manual input volume in `[0, 1]`. Only read when `volumeMode="manual"`. */
		manualInput?: number;
		/** Manual output volume in `[0, 1]`. Only read when `volumeMode="manual"`. */
		manualOutput?: number;
		/**
		 * Called every frame to sample input volume in `[0, 1]`. Used when `manualInput` is not provided.
		 */
		getInputVolume?: () => number;
		/**
		 * Called every frame to sample output volume in `[0, 1]`. Used when `manualOutput` is not provided.
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
		resizeDebounce = 100,
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
	let container = $state<HTMLDivElement>();
	let measured = $state<{ width: number; height: number }>();
	$effect(() => {
		if (!container) return;
		const delay = Math.max(0, resizeDebounce);
		let initialized = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const observer = new ResizeObserver(([entry]) => {
			clearTimeout(timer);
			const next = { width: entry.contentRect.width, height: entry.contentRect.height };
			if (!initialized || !delay) {
				initialized = true;
				measured = next;
			} else timer = setTimeout(() => (measured = next), delay);
		});
		observer.observe(container);
		return () => {
			observer.disconnect();
			clearTimeout(timer);
		};
	});
</script>

<div
	bind:this={container}
	data-slot="orb"
	class={cn("relative h-full w-full", className)}
	{...restProps}
>
	<div
		class="h-full w-full"
		style:width={measured ? `${measured.width}px` : undefined}
		style:height={measured ? `${measured.height}px` : undefined}
	>
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
</div>
