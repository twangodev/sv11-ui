<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import type { TranscriptionAdapter } from "./types.js";
	import type { SpeechInputData, ButtonSize } from "./context.svelte.js";

	export type SpeechInputProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "onerror"> & {
		/**
		 * STT backend bridge that owns the transcription session. Conforms to
		 * [`TranscriptionAdapter`](/docs/providers#transcriptionadapter).
		 */
		adapter: TranscriptionAdapter;
		/**
		 * Shared size applied to `SpeechInputRecordButton` and
		 * `SpeechInputCancelButton` via context.
		 * @default "default"
		 */
		size?: ButtonSize;
		/** Fired once the adapter reports the connection is ready for audio. */
		onStart?: (data: SpeechInputData) => void;
		/**
		 * Fired when the user stops recording. Receives a snapshot of the
		 * transcript — any in-flight partial is preserved.
		 */
		onStop?: (data: SpeechInputData) => void;
		/**
		 * Fired when the user cancels recording. Receives the snapshot taken
		 * before partial + committed state is cleared.
		 */
		onCancel?: (data: SpeechInputData) => void;
		/** Fired on every partial or committed transcript update. */
		onChange?: (data: SpeechInputData) => void;
		/** Fired when the adapter surfaces an error or `start()` rejects. */
		onError?: (error: Error) => void;
		/**
		 * Compound children — typically `SpeechInputRecordButton`,
		 * `SpeechInputPreview`, and `SpeechInputCancelButton` in any order.
		 */
		children?: Snippet;
		/** Bindable ref to the root `<div>` element. */
		ref?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import { onDestroy } from "svelte";
	import { cn } from "$lib/utils.js";
	import { setSpeechInput } from "./context.svelte.js";

	let {
		adapter,
		size = "default",
		onStart,
		onStop,
		onCancel,
		onChange,
		onError,
		class: className,
		children,
		ref = $bindable(null),
		...rest
	}: SpeechInputProps = $props();

	const state = setSpeechInput();

	// Adapter changes apply on the next start; callbacks stay current.
	$effect(() => {
		state.configure({
			adapter,
			callbacks: { onStart, onStop, onCancel, onChange, onError },
		});
		state.size = size;
	});

	onDestroy(() => {
		void state.dispose();
	});
</script>

<div
	bind:this={ref}
	data-slot="speech-input-root"
	class={cn(
		"relative inline-flex items-center overflow-hidden rounded-md transition-all duration-200",
		(state.isConnected || state.status === "stopping") &&
			"bg-background dark:bg-muted shadow-[inset_0_0_0_1px_var(--color-input),0_1px_2px_0_rgba(0,0,0,0.05)]",
		className
	)}
	{...rest}
>
	{@render children?.()}
</div>
