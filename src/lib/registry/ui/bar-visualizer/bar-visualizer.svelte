<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";

	export type AgentState = "connecting" | "initializing" | "listening" | "speaking" | "thinking";

	export type BarVisualizerProps = HTMLAttributes<HTMLDivElement> & {
		/**
		 * Voice-agent lifecycle state. Drives the bar highlight sequence and
		 * animation cadence. Leave undefined for a static row.
		 */
		state?: AgentState;
		/**
		 * Number of bars to render across the visualizer.
		 * @default 15
		 */
		barCount?: number;
		/**
		 * Live audio source used for FFT analysis. Ignored when `demo` is
		 * `true`. Pass `null` to disable analysis without unmounting.
		 */
		mediaStream?: MediaStream | null;
		/**
		 * Minimum bar height as a percentage of the container.
		 * @default 20
		 */
		minHeight?: number;
		/**
		 * Maximum bar height as a percentage of the container.
		 * @default 100
		 */
		maxHeight?: number;
		/**
		 * When `true`, replaces the FFT feed with a synthetic oscillating
		 * pattern. Useful for previews and documentation.
		 * @default false
		 */
		demo?: boolean;
		/**
		 * Align bars from the vertical center rather than growing up from the
		 * bottom.
		 * @default false
		 */
		centerAlign?: boolean;
		/** Bound reference to the root container element. */
		ref?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import {
		createAudioAnalyser,
		generateConnectingSequenceBar,
		generateListeningSequenceBar,
		normalizeDb,
	} from "./utils.js";

	let {
		state: agentState,
		barCount = 15,
		mediaStream,
		minHeight = 20,
		maxHeight = 100,
		demo = false,
		centerAlign = false,
		class: className,
		style,
		ref = $bindable(null),
		...restProps
	}: BarVisualizerProps = $props();

	let realBands = $state<number[]>(new Array(barCount).fill(0));
	let fakeBands = $state<number[]>(new Array(barCount).fill(0.2));
	let highlightedIndices = $state<number[]>([]);

	const volumeBands = $derived(demo ? fakeBands : realBands);

	const animInterval = $derived(
		agentState === "connecting"
			? 2000 / barCount
			: agentState === "thinking"
				? 150
				: agentState === "listening"
					? 500
					: 1000
	);

	// useMultibandVolume — real FFT analysis
	$effect(() => {
		if (demo || !mediaStream) {
			realBands = new Array(barCount).fill(0);
			return;
		}
		const currentBarCount = barCount;
		const { analyser, cleanup } = createAudioAnalyser(mediaStream, { fftSize: 2048 });

		const bufferLength = analyser.frequencyBinCount;
		const dataArray = new Float32Array(bufferLength);
		const sliceStart = 100;
		const sliceEnd = 200;
		const sliceLength = sliceEnd - sliceStart;
		const chunkSize = Math.ceil(sliceLength / currentBarCount);
		const updateInterval = 32;

		let lastUpdate = 0;
		let rafId: number | null = null;
		const bandsRef = new Array(currentBarCount).fill(0);

		const tick = (timestamp: number) => {
			if (timestamp - lastUpdate >= updateInterval) {
				analyser.getFloatFrequencyData(dataArray);
				const chunks = new Array<number>(currentBarCount);
				for (let i = 0; i < currentBarCount; i++) {
					let sum = 0;
					let count = 0;
					const startIdx = sliceStart + i * chunkSize;
					const endIdx = Math.min(sliceStart + (i + 1) * chunkSize, sliceEnd);
					for (let j = startIdx; j < endIdx; j++) {
						sum += normalizeDb(dataArray[j]);
						count++;
					}
					chunks[i] = count > 0 ? sum / count : 0;
				}

				let hasChanged = false;
				for (let i = 0; i < chunks.length; i++) {
					if (Math.abs(chunks[i] - bandsRef[i]) > 0.01) {
						hasChanged = true;
						break;
					}
				}
				if (hasChanged) {
					for (let i = 0; i < chunks.length; i++) bandsRef[i] = chunks[i];
					realBands = chunks;
				}
				lastUpdate = timestamp;
			}
			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);
		return () => {
			cleanup();
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	});

	// Demo mode fake bands
	$effect(() => {
		if (!demo) return;
		const currentBarCount = barCount;
		if (agentState !== "speaking" && agentState !== "listening") {
			fakeBands = new Array(currentBarCount).fill(0.2);
			return;
		}

		let lastUpdate = 0;
		const updateInterval = 50;
		const startTime = Date.now() / 1000;
		const bandsRef = new Array(currentBarCount).fill(0.2);
		let rafId: number | null = null;

		const tick = (timestamp: number) => {
			if (timestamp - lastUpdate >= updateInterval) {
				const time = Date.now() / 1000 - startTime;
				const newBands = new Array<number>(currentBarCount);
				for (let i = 0; i < currentBarCount; i++) {
					const waveOffset = i * 0.5;
					const baseVolume = Math.sin(time * 2 + waveOffset) * 0.3 + 0.5;
					const randomNoise = Math.random() * 0.2;
					newBands[i] = Math.max(0.1, Math.min(1, baseVolume + randomNoise));
				}

				let hasChanged = false;
				for (let i = 0; i < currentBarCount; i++) {
					if (Math.abs(newBands[i] - bandsRef[i]) > 0.05) {
						hasChanged = true;
						break;
					}
				}
				if (hasChanged) {
					for (let i = 0; i < currentBarCount; i++) bandsRef[i] = newBands[i];
					fakeBands = newBands;
				}
				lastUpdate = timestamp;
			}
			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	});

	// useBarAnimator — state-driven sequence
	$effect(() => {
		const currentState = agentState;
		const currentBarCount = barCount;
		const currentInterval = animInterval;

		let sequence: number[][];
		if (currentState === "thinking" || currentState === "listening") {
			sequence = generateListeningSequenceBar(currentBarCount);
		} else if (currentState === "connecting" || currentState === "initializing") {
			sequence = generateConnectingSequenceBar(currentBarCount);
		} else if (currentState === undefined || currentState === "speaking") {
			sequence = [new Array(currentBarCount).fill(0).map((_, idx) => idx)];
		} else {
			sequence = [[]];
		}

		let index = 0;
		highlightedIndices = sequence[0] || [];

		let startTime = performance.now();
		let rafId: number | null = null;

		const animate = (time: number) => {
			if (time - startTime >= currentInterval) {
				index = (index + 1) % sequence.length;
				highlightedIndices = sequence[index] || [];
				startTime = time;
			}
			rafId = requestAnimationFrame(animate);
		};

		rafId = requestAnimationFrame(animate);
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	});
</script>

<div
	bind:this={ref}
	data-state={agentState}
	class={cn(
		"relative flex justify-center gap-1.5",
		centerAlign ? "items-center" : "items-end",
		"bg-muted h-32 w-full overflow-hidden rounded-lg p-4",
		className
	)}
	{style}
	{...restProps}
	data-slot="bar-visualizer"
>
	{#each volumeBands as volume, index (index)}
		{@const heightPct = Math.min(maxHeight, Math.max(minHeight, volume * 100 + 5))}
		{@const isHighlighted = highlightedIndices.includes(index)}
		<div
			data-highlighted={isHighlighted}
			class={cn(
				"max-w-[12px] min-w-[8px] flex-1 rounded-full transition-all duration-150",
				"bg-border data-[highlighted=true]:bg-primary",
				agentState === "speaking" && "bg-primary",
				agentState === "thinking" && isHighlighted && "animate-pulse"
			)}
			style="height: {heightPct}%;{agentState === 'thinking' ? ' animation-duration: 300ms;' : ''}"
		></div>
	{/each}
</div>
