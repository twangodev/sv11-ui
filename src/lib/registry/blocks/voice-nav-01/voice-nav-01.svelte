<script lang="ts" module>
	import type { VoiceNavDestination } from "./destinations.js";

	export type VoiceNavResolver = (
		transcript: string,
		destinations: VoiceNavDestination[],
		signal?: AbortSignal
	) => Promise<string | null> | string | null;

	export type VoiceNav01Props = {
		/** Pages the user can navigate to by voice. */
		destinations?: VoiceNavDestination[];
		/**
		 * Maps a spoken transcript to a destination URL (or `null`). Defaults to
		 * keyword matching; pass an LLM-backed resolver for fuzzy intent.
		 */
		resolve?: VoiceNavResolver;
		/** Record audio and use any transcription provider instead of browser recognition. */
		transcribe?: import("$lib/registry/ui/voice-session/types.js").TranscribeAudio;
		/** Initial URL shown in the frame. */
		initialUrl?: string;
		class?: string;
	};
</script>

<script lang="ts">
	import { AudioRecorder } from "$lib/registry/ui/voice-session/recording.js";
	import { onDestroy, onMount } from "svelte";
	import { cn } from "$lib/utils.js";
	import { Card, CardDescription, CardHeader, CardTitle } from "$lib/registry/ui/card/index.js";
	import { VoiceButton, type VoiceButtonState } from "$lib/registry/ui/voice-button/index.js";
	import { DEFAULT_DESTINATIONS, matchDestination } from "./destinations.js";
	import { OneShotRecognizer, isSpeechRecognitionSupported } from "./speech.js";

	let {
		destinations = DEFAULT_DESTINATIONS,
		resolve = matchDestination,
		transcribe,
		initialUrl = "/docs/components",
		class: className,
	}: VoiceNav01Props = $props();

	let voiceState = $state<VoiceButtonState>("idle");
	let url = $state(initialUrl);
	let frameKey = $state(0);
	let error = $state("");

	// Optimistic until mounted so prerendered HTML doesn't flash the "unsupported"
	// note before the client can feature-detect.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const supported = $derived(!mounted || !!transcribe || isSpeechRecognitionSupported());
	const recognizer = new OneShotRecognizer();
	const recorder = new AudioRecorder();
	let request: AbortController | undefined;
	let revertTimer: ReturnType<typeof setTimeout> | null = null;

	// A custom resolve() is untrusted input. Only load http(s) URLs or same-origin
	// paths into the preview frame — never javascript:/data:/blob: schemes.
	function isSafeUrl(value: string): boolean {
		try {
			const { protocol } = new URL(value, window.location.origin);
			return protocol === "http:" || protocol === "https:";
		} catch {
			return false;
		}
	}

	function revertSoon() {
		if (revertTimer) clearTimeout(revertTimer);
		revertTimer = setTimeout(() => {
			if (voiceState === "success" || voiceState === "error") voiceState = "idle";
		}, 1800);
	}

	async function navigate(transcript: string, current: AbortController) {
		if (!transcript || current.signal.aborted) return;
		voiceState = "processing";
		const dest = await resolve(transcript, destinations, current.signal);
		if (current.signal.aborted) return;
		if (!dest) {
			error = `Couldn't match "${transcript}" to a page.`;
			voiceState = "error";
		} else if (!isSafeUrl(dest)) {
			error = "Refused to open an unsafe URL.";
			voiceState = "error";
		} else {
			url = dest;
			frameKey += 1;
			voiceState = "success";
		}
	}
	async function handlePress() {
		if (!supported || voiceState === "processing") return;
		if (voiceState === "recording" && !transcribe) {
			request?.abort();
			recognizer.abort();
			voiceState = "idle";
			return;
		}
		if (voiceState !== "recording") {
			request?.abort();
			request = new AbortController();
			error = "";
			voiceState = "recording";
			if (transcribe) {
				try {
					await recorder.start();
				} catch (cause) {
					if (!request.signal.aborted) {
						error = cause instanceof Error ? cause.message : "Could not record audio.";
						voiceState = "error";
					}
				}
				return;
			}
		}
		const current = request!;
		try {
			let transcript: string;
			if (transcribe) {
				voiceState = "processing";
				const audio = await recorder.stop();
				transcript = await transcribe(audio, current.signal);
			} else transcript = await recognizer.start(navigator.language || "en-US");
			if (!transcript && !current.signal.aborted) voiceState = "idle";
			await navigate(transcript, current);
		} catch (cause) {
			if (!current.signal.aborted) {
				error = cause instanceof Error ? cause.message : "Voice navigation failed.";
				voiceState = "error";
			}
		} finally {
			if (!current.signal.aborted) revertSoon();
		}
	}

	function onKeydown(event: KeyboardEvent) {
		// ⌥Space toggles voice nav — but not while typing in a field.
		const target = event.target as HTMLElement | null;
		if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable)
			return;
		if (event.altKey && event.code === "Space") {
			event.preventDefault();
			void handlePress();
		}
	}

	onDestroy(() => {
		request?.abort();
		recorder.cancel();
		recognizer.abort();
		if (revertTimer) clearTimeout(revertTimer);
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div data-slot="voice-nav-01" class={cn("mx-auto w-full", className)}>
	<Card class="border-border relative m-0 gap-0 overflow-hidden p-0 shadow-2xl">
		<Card class="rounded-none border-x-0 border-t-0">
			<CardHeader>
				<div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
					<div class="space-y-1">
						<CardTitle>Voice Navigation</CardTitle>
						<CardDescription
							>Navigate websites with your voice (e.g., “Take me to the orb component”)</CardDescription
						>
					</div>
					<VoiceButton
						state={voiceState}
						getLevel={transcribe ? recorder.getLevel : undefined}
						onPress={handlePress}
						disabled={!supported}
						label="Voice Nav"
						trailing="⌥Space"
						title="Voice Navigation"
					/>
				</div>
				{#if error}<p role="alert" class="text-destructive text-sm">{error}</p>{/if}
			</CardHeader>
		</Card>
		<div class="h-[calc(100vh-180px)] w-full">
			{#key frameKey}<iframe
					src={url}
					title="Voice navigation preview"
					class="h-full w-full border-0 bg-white"
				></iframe>{/key}
		</div>
		{#if !supported}
			<p class="text-muted-foreground p-4 text-xs">
				This demo uses the browser Web Speech API (Chromium-based browsers). Provide a custom <code
					class="bg-muted rounded px-1 py-0.5">resolve</code
				> backend for production intent matching.
			</p>
		{/if}
	</Card>
</div>
