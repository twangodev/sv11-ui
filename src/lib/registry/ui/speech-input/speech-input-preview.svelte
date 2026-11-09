<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";

	export type SpeechInputPreviewProps = HTMLAttributes<HTMLDivElement> & {
		/** Text shown when no transcript yet. Defaults to "Listening...". */
		placeholder?: string;
	};
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { useSpeechInput } from "./context.svelte.js";

	let {
		class: className,
		placeholder = "Listening...",
		...rest
	}: SpeechInputPreviewProps = $props();

	const state = useSpeechInput();

	const displayText = $derived(state.transcript || placeholder);
	const showPreview = $derived(state.isConnected || state.status === "stopping");
	const showPlaceholder = $derived(!state.transcript.trim());
</script>

<div
	inert={!showPreview}
	aria-hidden={!showPreview}
	title={displayText}
	class={cn(
		"relative self-stretch text-sm transition-[opacity,transform,width] duration-200 ease-out",
		showPlaceholder ? "text-muted-foreground italic" : "text-muted-foreground",
		showPreview ? "w-28 opacity-100" : "w-0 opacity-0",
		className
	)}
	data-slot="speech-input-preview"
	{...rest}
>
	<div
		class="absolute inset-y-0 -right-1 -left-1 [mask-image:linear-gradient(to_right,transparent,black_10px,black_calc(100%-10px),transparent)]"
	>
		<p
			class="absolute top-0 right-0 bottom-0 flex h-full min-w-full items-center px-1 whitespace-nowrap"
		>
			{displayText}
		</p>
	</div>
</div>
