<script lang="ts" module>
	import type { VoiceNavDestination } from "./destinations.js";

	export type VoiceNavResolver = (
		transcript: string,
		destinations: VoiceNavDestination[]
	) => Promise<string | null> | string | null;

	export type VoiceNav01Props = {
		/** Pages the user can navigate to by voice. */
		destinations?: VoiceNavDestination[];
		/**
		 * Maps a spoken transcript to a destination URL (or `null`). Defaults to
		 * keyword matching; pass an LLM-backed resolver for fuzzy intent.
		 */
		resolve?: VoiceNavResolver;
		/** Initial URL shown in the frame. */
		initialUrl?: string;
		class?: string;
	};
</script>

<script lang="ts">
	import { onDestroy } from "svelte";
	import { cn } from "$lib/utils.js";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/registry/ui/card/index.js";
	import { VoiceButton, type VoiceButtonState } from "$lib/registry/ui/voice-button/index.js";
	import { DEFAULT_DESTINATIONS, matchDestination } from "./destinations.js";
	import { OneShotRecognizer, isSpeechRecognitionSupported } from "./speech.js";

	let {
		destinations = DEFAULT_DESTINATIONS,
		resolve = matchDestination,
		initialUrl = "/docs/components",
		class: className,
	}: VoiceNav01Props = $props();

	let voiceState = $state<VoiceButtonState>("idle");
	let url = $state(initialUrl);
	let frameKey = $state(0);
	let error = $state("");
	let lastHeard = $state("");

	const supported = isSpeechRecognitionSupported();
	const recognizer = new OneShotRecognizer();
	let revertTimer: ReturnType<typeof setTimeout> | null = null;

	function revertSoon() {
		if (revertTimer) clearTimeout(revertTimer);
		revertTimer = setTimeout(() => {
			if (voiceState === "success" || voiceState === "error") voiceState = "idle";
		}, 1800);
	}

	async function handlePress() {
		if (!supported) return;
		if (voiceState === "recording" || voiceState === "processing") {
			recognizer.abort();
			voiceState = "idle";
			return;
		}

		error = "";
		voiceState = "recording";
		try {
			const transcript = await recognizer.start(navigator.language || "en-US");
			if (!transcript) {
				voiceState = "idle";
				return;
			}
			lastHeard = transcript;
			voiceState = "processing";
			const dest = await Promise.resolve(resolve(transcript, destinations));
			if (dest) {
				url = dest;
				frameKey += 1;
				voiceState = "success";
			} else {
				error = `Couldn't match "${transcript}" to a page.`;
				voiceState = "error";
			}
		} catch (err) {
			error = err instanceof Error ? err.message : "Voice navigation failed.";
			voiceState = "error";
		} finally {
			revertSoon();
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.altKey && event.code === "Space") {
			event.preventDefault();
			void handlePress();
		}
	}

	onDestroy(() => {
		recognizer.abort();
		if (revertTimer) clearTimeout(revertTimer);
	});
</script>

<svelte:window onkeydown={onKeydown} />

<Card class={cn("mx-auto flex w-full max-w-3xl flex-col overflow-hidden", className)}>
	<CardHeader>
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-1">
				<CardTitle>Voice Navigation</CardTitle>
				<CardDescription>
					Speak to navigate. Try <span class="text-foreground">“take me to the orb”</span> or
					<span class="text-foreground">“show me the blocks”</span>.
				</CardDescription>
			</div>
			<VoiceButton
				state={voiceState}
				onPress={handlePress}
				disabled={!supported}
				label="Voice Nav"
				trailing="⌥Space"
				title="Voice Navigation"
			/>
		</div>
		{#if error}
			<p class="text-destructive text-sm">{error}</p>
		{:else if lastHeard}
			<p class="text-muted-foreground text-sm">Heard: “{lastHeard}”</p>
		{/if}
	</CardHeader>
	<CardContent class="p-0">
		<div class="bg-muted/40 text-muted-foreground border-y px-4 py-2 font-mono text-xs">
			{url}
		</div>
		{#key frameKey}
			<iframe src={url} title="Voice navigation preview" class="h-[440px] w-full bg-white"></iframe>
		{/key}
		{#if !supported}
			<p class="text-muted-foreground p-4 text-xs">
				This demo uses the browser Web Speech API (Chromium-based browsers). Provide a custom
				<code class="bg-muted rounded px-1 py-0.5">resolve</code> backend for production intent matching.
			</p>
		{/if}
	</CardContent>
</Card>
