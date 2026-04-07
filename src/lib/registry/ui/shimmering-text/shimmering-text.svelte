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
		text: string;
		duration?: number;
		delay?: number;
		repeat?: boolean;
		repeatDelay?: number;
		class?: string;
		startOnView?: boolean;
		once?: boolean;
		inViewMargin?: NonNullable<Parameters<typeof inView>[2]>["margin"];
		spread?: number;
		color?: string;
		shimmerColor?: string;
	} = $props();

	let ref = $state<HTMLSpanElement>();
	let isInView = $state(false);
	let controls: ReturnType<typeof animate> | undefined;

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

		// Fade in
		animate(ref, { opacity: [0, 1] }, { duration: 0.3, delay });

		// Shimmer
		controls = animate(
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
			controls?.stop();
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
	style:opacity="0"
>
	{text}
</span>
