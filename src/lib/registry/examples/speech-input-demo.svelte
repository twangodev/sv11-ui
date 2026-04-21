<script lang="ts">
	import InfoIcon from "@lucide/svelte/icons/info";
	import {
		SpeechInput,
		SpeechInputRecordButton,
		SpeechInputPreview,
		SpeechInputCancelButton,
		type TranscriptionAdapter,
	} from "$lib/registry/ui/speech-input/index.js";
	import { Textarea } from "$lib/registry/ui/textarea/index.js";

	let value = $state("");
	let toastMessage = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(message: string) {
		if (toastTimer !== null) clearTimeout(toastTimer);
		toastMessage = message;
		toastTimer = setTimeout(() => {
			toastMessage = null;
			toastTimer = null;
		}, 3500);
	}

	// Stub adapter for the demo: throws so the SpeechInput surfaces an error
	// via the component's onError callback. The textarea + buttons render
	// exactly as they would with a real adapter — only the recognition step
	// is replaced with the toast.
	const demoAdapter: TranscriptionAdapter = {
		async start() {
			throw new Error("This is a demo — no speech-to-text backend is wired up.");
		},
		stop() {},
		cancel() {},
	};
</script>

<div class="flex w-full flex-col gap-3">
	<div class="relative">
		<Textarea
			bind:value
			placeholder="Jot down some thoughts..."
			class="min-h-[120px] resize-none rounded-2xl px-3.5 pt-3 pb-14"
		/>
		<div class="absolute right-3 bottom-3 flex items-center gap-2">
			<SpeechInput size="sm" adapter={demoAdapter} onError={(err) => showToast(err.message)}>
				<SpeechInputCancelButton />
				<SpeechInputPreview placeholder="Listening..." />
				<SpeechInputRecordButton />
			</SpeechInput>
		</div>

		{#if toastMessage}
			<div
				class="bg-foreground text-background animate-in fade-in slide-in-from-bottom-2 pointer-events-none absolute -top-2 right-0 -translate-y-full rounded-md px-3 py-2 text-xs shadow-lg duration-200"
				role="status"
			>
				{toastMessage}
			</div>
		{/if}
	</div>

	<div
		class="border-border bg-muted/40 text-muted-foreground flex items-start gap-3 rounded-md border p-3 text-xs"
		role="note"
	>
		<InfoIcon class="text-foreground mt-0.5 size-3.5 shrink-0" />
		<p>
			<code class="bg-muted rounded px-1 py-0.5">SpeechInput</code> is provider-agnostic — pass a
			<code class="bg-muted rounded px-1 py-0.5">TranscriptionAdapter</code> wired to ElevenLabs,
			Deepgram, OpenAI, or any other backend. This demo has no STT hooked up.
		</p>
	</div>
</div>
