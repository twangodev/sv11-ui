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
	import type { TranscribeAudio } from "$lib/registry/ui/voice-session/types.js";
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

	// Avoid an unsupported-browser flash before hydration.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const supported = $derived(!mounted || !!transcribe || isSpeechRecognitionSupported());
	const recognizer = new OneShotRecognizer();
	const recorder = new AudioRecorder();
	type NavigationAttempt = {
		controller: AbortController;
		resolve: VoiceNavResolver;
		destinations: VoiceNavDestination[];
	} & ({ mode: "recorded"; transcribe: TranscribeAudio } | { mode: "browser" });
	let activeAttempt = $state.raw<NavigationAttempt>();
	let revertTimer: ReturnType<typeof setTimeout> | undefined;
	const isCurrent = (attempt: NavigationAttempt) =>
		activeAttempt === attempt && !attempt.controller.signal.aborted;

	function cancelAttempt() {
		activeAttempt?.controller.abort();
		activeAttempt = undefined;
		recorder.cancel();
		recognizer.abort();
		clearTimeout(revertTimer);
	}

	$effect(() => {
		if (!transcribe && activeAttempt?.mode === "recorded") {
			cancelAttempt();
			voiceState = "idle";
		}
	});

	function isHttpUrl(value: string): boolean {
		try {
			const { protocol } = new URL(value, window.location.origin);
			return protocol === "http:" || protocol === "https:";
		} catch {
			return false;
		}
	}

	async function completeAttempt(current: NavigationAttempt) {
		try {
			let transcript: string;
			if (current.mode === "recorded") {
				voiceState = "processing";
				const audio = await recorder.stop();
				if (!isCurrent(current)) return;
				transcript = await current.transcribe(audio, current.controller.signal);
			} else transcript = await recognizer.start(navigator.language || "en-US");
			if (!isCurrent(current)) return;
			if (!transcript) {
				activeAttempt = undefined;
				voiceState = "idle";
				return;
			}
			voiceState = "processing";
			const destination = await current.resolve(
				transcript,
				current.destinations,
				current.controller.signal
			);
			if (!isCurrent(current)) return;
			if (!destination) {
				error = `Couldn't match "${transcript}" to a page.`;
				voiceState = "error";
			} else if (!isHttpUrl(destination)) {
				error = "Refused to open an unsafe URL.";
				voiceState = "error";
			} else {
				url = destination;
				frameKey += 1;
				voiceState = "success";
			}
		} catch (cause) {
			if (isCurrent(current)) {
				error = cause instanceof Error ? cause.message : "Voice navigation failed.";
				voiceState = "error";
			}
		} finally {
			if (isCurrent(current))
				revertTimer = setTimeout(() => {
					if (isCurrent(current)) {
						activeAttempt = undefined;
						voiceState = "idle";
					}
				}, 1800);
		}
	}

	async function handlePress() {
		if (voiceState === "processing") return;
		if (voiceState === "recording" && activeAttempt) {
			if (activeAttempt.mode === "browser") {
				cancelAttempt();
				voiceState = "idle";
			} else await completeAttempt(activeAttempt);
			return;
		}
		if (!supported) return;
		cancelAttempt();
		const current: NavigationAttempt = {
			controller: new AbortController(),
			resolve,
			destinations,
			...(transcribe ? { mode: "recorded", transcribe } : { mode: "browser" }),
		};
		activeAttempt = current;
		error = "";
		voiceState = "recording";
		if (current.mode === "browser") {
			await completeAttempt(current);
			return;
		}
		try {
			await recorder.start();
		} catch (cause) {
			if (isCurrent(current)) {
				error = cause instanceof Error ? cause.message : "Could not record audio.";
				voiceState = "error";
			}
		}
	}

	function onKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable)
			return;
		if (event.altKey && event.code === "Space") {
			event.preventDefault();
			void handlePress();
		}
	}

	onDestroy(cancelAttempt);
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
						getLevel={activeAttempt?.mode === "recorded" ? recorder.getLevel : undefined}
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
