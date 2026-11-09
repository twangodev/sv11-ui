<script lang="ts" module>
	import type { ComponentProps } from "svelte";
	import { Button } from "$lib/registry/ui/button/index.js";

	export type SpeechInputRecordButtonProps = Omit<
		ComponentProps<typeof Button>,
		"size" | "onclick"
	> & {
		onclick?: (e: MouseEvent) => void;
	};
</script>

<script lang="ts">
	import MicIcon from "@lucide/svelte/icons/mic";
	import SquareIcon from "@lucide/svelte/icons/square";
	import { Skeleton } from "$lib/registry/ui/skeleton/index.js";
	import { cn } from "$lib/utils.js";
	import { useSpeechInput } from "./context.svelte.js";
	import { buttonSizeVariants } from "./variants.js";

	let {
		class: className,
		onclick,
		variant = "ghost",
		disabled,
		...rest
	}: SpeechInputRecordButtonProps = $props();

	const state = useSpeechInput();
</script>

<Button
	type="button"
	{variant}
	disabled={disabled || state.isConnecting}
	onclick={(e) => {
		if (state.isConnected) {
			void state.stop();
		} else {
			void state.start();
		}
		onclick?.(e);
	}}
	aria-label={state.isConnected ? "Stop recording" : "Start recording"}
	class={cn(
		buttonSizeVariants({ size: state.size }),
		"relative flex items-center justify-center transition-all",
		state.isConnected && "scale-[80%]",
		className
	)}
	data-slot="speech-input-record-button"
	{...rest}
>
	<Skeleton
		class={cn(
			"absolute h-4 w-4 rounded-full transition-all duration-200",
			state.isConnecting ? "bg-primary scale-90" : "scale-[60%] bg-transparent"
		)}
	/>
	<SquareIcon
		class={cn(
			"text-destructive absolute h-4 w-4 fill-current transition-all duration-200",
			!state.isConnecting && state.isConnected ? "scale-100 opacity-100" : "scale-[60%] opacity-0"
		)}
	/>
	<MicIcon
		class={cn(
			"absolute h-4 w-4 transition-all duration-200",
			!state.isConnecting && !state.isConnected ? "scale-100 opacity-100" : "scale-[60%] opacity-0"
		)}
	/>
</Button>
