<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	function formatTimestamp(value: number): string {
		if (!Number.isFinite(value) || value < 0) return "0:00";
		const totalSeconds = Math.floor(value);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	let {
		class: className,
		time,
		format = formatTimestamp,
		...restProps
	}: HTMLAttributes<HTMLSpanElement> & {
		/** Time value in seconds to render. */
		time: number;
		/**
		 * Custom formatter applied to `time` before rendering. Defaults to
		 * `m:ss` (e.g. `1:07`).
		 */
		format?: (time: number) => string;
	} = $props();
</script>

<span data-slot="scrub-bar-time-label" class={cn("tabular-nums", className)} {...restProps}>
	{format(time)}
</span>
