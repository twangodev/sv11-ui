<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { Frame } from "./presets.js";

	export type MatrixMode = "default" | "vu";

	export type MatrixProps = HTMLAttributes<HTMLDivElement> & {
		/** Number of rows in the matrix grid. */
		rows: number;
		/** Number of columns in the matrix grid. */
		cols: number;
		/**
		 * Static pattern to display. A 2D array of brightness values in
		 * `[0, 1]`. When set, animation is disabled and `frames` is ignored.
		 */
		pattern?: Frame;
		/**
		 * Ordered frames to loop through for animation. Ignored when
		 * `pattern` is provided.
		 */
		frames?: Frame[];
		/**
		 * Playback rate in frames per second when animating `frames`.
		 * @default 12
		 */
		fps?: number;
		/**
		 * Start animating automatically on mount. Ignored when a static
		 * `pattern` is provided.
		 * @default true
		 */
		autoplay?: boolean;
		/**
		 * Loop the frame sequence. When `false`, animation halts on the last
		 * frame.
		 * @default true
		 */
		loop?: boolean;
		/**
		 * Cell diameter in pixels.
		 * @default 10
		 */
		size?: number;
		/**
		 * Gap between cells in pixels.
		 * @default 2
		 */
		gap?: number;
		/**
		 * CSS colors for active and inactive cells. Defaults map `on` to the
		 * current text color and `off` to the muted foreground token.
		 * @default { on: "currentColor", off: "var(--muted-foreground)" }
		 */
		palette?: { on: string; off: string };
		/**
		 * Global brightness multiplier applied to every cell, clamped to
		 * `[0, 1]`.
		 * @default 1
		 */
		brightness?: number;
		/**
		 * ARIA label for the container. Falls back to `"matrix display"` when
		 * omitted.
		 */
		ariaLabel?: string;
		/** Invoked whenever the active frame index changes during animation. */
		onFrame?: (index: number) => void;
		/**
		 * Rendering mode. `"vu"` reads `levels` each render to draw a
		 * bottom-anchored meter instead of `frames` or `pattern`.
		 * @default "default"
		 */
		mode?: MatrixMode;
		/**
		 * Per-column level values in `[0, 1]` used when `mode="vu"`. Ignored
		 * in other modes.
		 */
		levels?: number[];
		/** Bound reference to the root container element. */
		ref?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { clamp, ensureFrameSize, vu } from "./presets.js";

	let {
		rows,
		cols,
		pattern,
		frames,
		fps = 12,
		autoplay = true,
		loop = true,
		size = 10,
		gap = 2,
		palette = { on: "currentColor", off: "var(--muted-foreground)" },
		brightness = 1,
		ariaLabel,
		onFrame,
		mode = "default",
		levels,
		class: className,
		ref = $bindable(null),
		...restProps
	}: MatrixProps = $props();

	let frameIndex = $state(0);
	let isPlaying = $state(true);
	let rafId: number | null = null;
	let lastTime = 0;
	let accumulator = 0;

	// Reset animation state when frames or autoplay change (mirrors React dep array)
	$effect(() => {
		void frames;
		frameIndex = 0;
		isPlaying = autoplay && !pattern;
		lastTime = 0;
		accumulator = 0;
	});

	// Animation loop — fixed-timestep accumulator
	$effect(() => {
		if (!frames || frames.length === 0 || !isPlaying) return;
		const frameInterval = 1000 / fps;
		// Capture loop + onFrame so effect re-runs on changes
		const currentLoop = loop;
		const currentOnFrame = onFrame;

		const animate = (currentTime: number) => {
			if (lastTime === 0) lastTime = currentTime;
			const deltaTime = currentTime - lastTime;
			lastTime = currentTime;
			accumulator += deltaTime;

			if (accumulator >= frameInterval) {
				accumulator -= frameInterval;
				const next = frameIndex + 1;
				if (next >= frames!.length) {
					if (currentLoop) {
						frameIndex = 0;
						currentOnFrame?.(0);
					} else {
						isPlaying = false;
						return;
					}
				} else {
					frameIndex = next;
					currentOnFrame?.(next);
				}
			}

			rafId = requestAnimationFrame(animate);
		};

		rafId = requestAnimationFrame(animate);

		return () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		};
	});

	const currentFrame = $derived.by(() => {
		if (mode === "vu" && levels && levels.length > 0) {
			return ensureFrameSize(vu(cols, levels), rows, cols);
		}
		if (pattern) {
			return ensureFrameSize(pattern, rows, cols);
		}
		if (frames && frames.length > 0) {
			return ensureFrameSize(frames[frameIndex] || frames[0], rows, cols);
		}
		return ensureFrameSize([], rows, cols);
	});

	const cellPositions = $derived.by(() => {
		const positions: { x: number; y: number }[][] = [];
		for (let row = 0; row < rows; row++) {
			positions[row] = [];
			for (let col = 0; col < cols; col++) {
				positions[row][col] = {
					x: col * (size + gap),
					y: row * (size + gap),
				};
			}
		}
		return positions;
	});

	const svgDimensions = $derived({
		width: cols * (size + gap) - gap,
		height: rows * (size + gap) - gap,
	});

	// SVG `id` is document-global: multiple <Matrix> instances on a page would
	// all reference the first instance's gradients/filter. Namespace every
	// defined id with a stable per-instance prefix.
	const uid = $props.id();
	const onId = `matrix-pixel-on-${uid}`;
	const offId = `matrix-pixel-off-${uid}`;
	const glowId = `matrix-glow-${uid}`;
</script>

<div
	bind:this={ref}
	data-slot="matrix"
	role="img"
	aria-label={ariaLabel ?? "matrix display"}
	class={cn("relative inline-block", className)}
	style="--matrix-on: {palette.on}; --matrix-off: {palette.off}; --matrix-gap: {gap}px; --matrix-size: {size}px;"
	{...restProps}
>
	<svg
		width={svgDimensions.width}
		height={svgDimensions.height}
		viewBox="0 0 {svgDimensions.width} {svgDimensions.height}"
		xmlns="http://www.w3.org/2000/svg"
		class="block"
		style="overflow: visible;"
	>
		<defs>
			<radialGradient id={onId} cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="var(--matrix-on)" stop-opacity="1" />
				<stop offset="70%" stop-color="var(--matrix-on)" stop-opacity="0.85" />
				<stop offset="100%" stop-color="var(--matrix-on)" stop-opacity="0.6" />
			</radialGradient>
			<radialGradient id={offId} cx="50%" cy="50%" r="50%">
				<stop offset="0%" stop-color="var(--matrix-off)" stop-opacity="1" />
				<stop offset="100%" stop-color="var(--matrix-off)" stop-opacity="0.7" />
			</radialGradient>
			<filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
				<feGaussianBlur stdDeviation="2" result="blur" />
				<feComposite in="SourceGraphic" in2="blur" operator="over" />
			</filter>
		</defs>

		{#each currentFrame as row, rowIndex (rowIndex)}
			{#each row as value, colIndex (colIndex)}
				{@const pos = cellPositions[rowIndex]?.[colIndex]}
				{#if pos}
					{@const opacity = clamp(brightness * value)}
					{@const isActive = opacity > 0.5}
					{@const isOn = opacity > 0.05}
					<circle
						class={cn("matrix-pixel", !isOn && "opacity-20 dark:opacity-[0.1]")}
						cx={pos.x + size / 2}
						cy={pos.y + size / 2}
						r={(size / 2) * 0.9}
						fill={isOn ? `url(#${onId})` : `url(#${offId})`}
						opacity={isOn ? opacity : 0.1}
						style="transform: scale({isActive ? 1.1 : 1}); filter: {isActive
							? `url(#${glowId})`
							: 'none'};"
					/>
				{/if}
			{/each}
		{/each}
	</svg>
</div>

<style>
	:global(.matrix-pixel) {
		transition:
			opacity 300ms ease-out,
			transform 150ms ease-out,
			filter 150ms ease-out;
		transform-origin: center;
		transform-box: fill-box;
	}
</style>
