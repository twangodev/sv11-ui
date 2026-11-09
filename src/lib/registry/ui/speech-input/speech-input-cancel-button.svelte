<script lang="ts" module>
	import type { ComponentProps } from "svelte";
	import { Button } from "$lib/registry/ui/button/index.js";

	export type SpeechInputCancelButtonProps = Omit<
		ComponentProps<typeof Button>,
		"size" | "onclick"
	> & {
		onclick?: (e: MouseEvent) => void;
	};
</script>

<script lang="ts">
	import XIcon from "@lucide/svelte/icons/x";
	import { cn } from "$lib/utils.js";
	import { useSpeechInput } from "./context.svelte.js";
	import { buttonSizeVariants } from "./variants.js";

	let {
		class: className,
		onclick,
		variant = "ghost",
		...rest
	}: SpeechInputCancelButtonProps = $props();

	const state = useSpeechInput();
</script>

<Button
	type="button"
	{variant}
	inert={!state.canCancel}
	onclick={(e) => {
		void state.cancel();
		onclick?.(e);
	}}
	aria-label="Cancel recording"
	class={cn(
		buttonSizeVariants({ size: state.size }),
		"transition-[opacity,transform,width] duration-200 ease-out",
		state.canCancel ? "scale-[80%] opacity-100" : "pointer-events-none w-0 scale-100 opacity-0",
		className
	)}
	data-slot="speech-input-cancel-button"
	{...rest}
>
	<XIcon class="h-3 w-3" />
</Button>
