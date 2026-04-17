<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";
	import { setScrubBarContext } from "./context.js";

	let {
		class: className,
		duration,
		value,
		onScrub,
		onScrubStart,
		onScrubEnd,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		/** Total duration of the timeline, in seconds. */
		duration: number;
		/** Current playback time, in seconds. */
		value: number;
		/** Called with the new time (in seconds) as the user scrubs. */
		onScrub?: (time: number) => void;
		/** Called when the user presses down on the track or thumb. */
		onScrubStart?: () => void;
		/** Called when the user releases the pointer after scrubbing. */
		onScrubEnd?: () => void;
		children?: Snippet;
	} = $props();

	const progress = $derived(duration > 0 ? (value / duration) * 100 : 0);

	setScrubBarContext({
		get duration() {
			return duration;
		},
		get value() {
			return value;
		},
		get progress() {
			return progress;
		},
		get onScrub() {
			return onScrub;
		},
		get onScrubStart() {
			return onScrubStart;
		},
		get onScrubEnd() {
			return onScrubEnd;
		},
	});
</script>

<div data-slot="scrub-bar-root" class={cn("flex w-full items-center", className)} {...restProps}>
	{@render children?.()}
</div>
