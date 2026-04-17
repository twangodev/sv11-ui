<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { animate, inView } from "motion";

	let {
		text,
		duration = 2,
		delay = 0,
		repeat = true,
		repeatDelay = 0.5,
		class: className,
		startOnView = true,
		once = false,
		inViewMargin,
		spread = 2,
		color,
		shimmerColor,
	}: {
		/** Text to display with the shimmer effect. */
		text: string;
		/**
		 * Duration of one shimmer sweep in seconds.
		 * @default 2
		 */
		duration?: number;
		/**
		 * Seconds to wait before the first sweep begins.
		 * @default 0
		 */
		delay?: number;
		/**
		 * Whether the shimmer sweep loops indefinitely.
		 * @default true
		 */
		repeat?: boolean;
		/**
		 * Pause between repeats in seconds when `repeat` is `true`.
		 * @default 0.5
		 */
		repeatDelay?: number;
		/** Extra classes merged onto the root `<span>`. */
		class?: string;
		/**
		 * When `true`, the animation only starts once the element scrolls into
		 * view. When `false`, it begins on mount.
		 * @default true
		 */
		startOnView?: boolean;
		/**
		 * When `true`, the animation fires a single time and never again.
		 * When `false`, it replays each time the element re-enters the viewport.
		 * @default false
		 */
		once?: boolean;
		/**
		 * Root margin passed to the underlying Motion `inView` observer — used
		 * to shrink or expand the viewport trigger area (e.g. `"0px 0px -10%"`).
		 */
		inViewMargin?: NonNullable<Parameters<typeof inView>[2]>["margin"];
		/**
		 * Spread multiplier applied to the shimmer highlight width. The final
		 * spread scales with text length (`text.length * spread` pixels).
		 * @default 2
		 */
		spread?: number;
		/** Base text color. Defaults to `var(--muted-foreground)`. */
		color?: string;
		/** Highlight gradient color. Defaults to `var(--foreground)`. */
		shimmerColor?: string;
	} = $props();

	let ref = $state<HTMLSpanElement>();
	let isInView = $state(false);
	let hasAnimated = $state(false);
	let shimmerControls: ReturnType<typeof animate> | undefined;
	let fadeControls: ReturnType<typeof animate> | undefined;

	let dynamicSpread = $derived(text.length * spread);
	let shouldAnimate = $derived(!startOnView || isInView);

	// Viewport detection
	$effect(() => {
		if (!ref) return;
		return inView(
			ref,
			() => {
				isInView = true;
				if (!once) {
					return () => {
						isInView = false;
					};
				}
			},
			{ margin: inViewMargin }
		);
	});

	// Shimmer animation
	$effect(() => {
		if (!ref || !shouldAnimate) return;
		hasAnimated = true;

		fadeControls = animate(ref, { opacity: [0, 1] }, { duration: 0.3, delay });

		shimmerControls = animate(
			ref,
			{ backgroundPosition: ["100% center", "0% center"] },
			{
				duration,
				delay,
				repeat: repeat ? Infinity : 0,
				repeatDelay,
				ease: "linear",
			}
		);

		return () => {
			shimmerControls?.stop();
			fadeControls?.stop();
		};
	});
</script>

<span
	bind:this={ref}
	data-slot="shimmering-text"
	class={cn(
		"relative inline-block bg-size-[250%_100%,auto] bg-clip-text text-transparent",
		"[--base-color:var(--muted-foreground)] [--shimmer-color:var(--foreground)]",
		"[background-repeat:no-repeat,padding-box]",
		"[--shimmer-bg:linear-gradient(90deg,transparent_calc(50%-var(--spread)),var(--shimmer-color),transparent_calc(50%+var(--spread)))]",
		"dark:[--base-color:var(--muted-foreground)] dark:[--shimmer-color:var(--foreground)]",
		className
	)}
	style:--spread="{dynamicSpread}px"
	style:--base-color={color || undefined}
	style:--shimmer-color={shimmerColor || undefined}
	style:background-image="var(--shimmer-bg), linear-gradient(var(--base-color), var(--base-color))"
	style:background-position={hasAnimated ? undefined : "100% center"}
	style:opacity={hasAnimated ? undefined : "0"}
>
	{text}
</span>
