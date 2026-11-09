<script lang="ts" module>
	import { tv } from "tailwind-variants";

	export const transcriber01Variants = tv({
		slots: {
			root: "mx-auto w-full",
			content: "relative py-6",
			stage: "flex h-32 items-center justify-center",
			scroll: "h-32 w-full",
			result: "text-foreground py-1 pr-8 text-left text-sm leading-relaxed",
			errorText: "text-destructive",
			emptyText: "text-muted-foreground",
			copyButton: "absolute top-1 right-2 size-6 opacity-50 transition-opacity hover:opacity-100",
			waveform: "w-full",
			toolbar: "bg-card flex items-center justify-between gap-3 px-4 py-2",
			timer: "text-muted-foreground/60 font-mono text-[10px] tracking-widest uppercase",
			kbd: "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none",
			note: "text-muted-foreground px-4 pb-2 text-xs",
			code: "bg-muted rounded px-1 py-0.5",
		},
	});

	export type Transcriber01Props = {
		/**
		 * Provider-agnostic transcription backend. Receives the recorded audio
		 * and resolves with the transcript text. When omitted, the block uses the
		 * browser Web Speech API as a zero-backend demo (Chromium only).
		 */
		transcribe?: import("$lib/registry/ui/voice-session/types.js").TranscribeAudio;
		class?: string;
	};
</script>

<script lang="ts">
	import { AudioRecorder } from "$lib/registry/ui/voice-session/recording.js";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import CheckIcon from "@lucide/svelte/icons/check";
	import { onDestroy, onMount } from "svelte";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card } from "$lib/registry/ui/card/index.js";
	import { ScrollArea } from "$lib/registry/ui/scroll-area/index.js";
	import { Separator } from "$lib/registry/ui/separator/index.js";
	import { LiveWaveform } from "$lib/registry/ui/live-waveform/index.js";
	import { Response } from "$lib/registry/ui/response/index.js";
	import { SpeechSession, isSpeechRecognitionSupported } from "./speech.js";

	let { transcribe, class: className }: Transcriber01Props = $props();

	const ui = transcriber01Variants();

	type Status = "idle" | "recording" | "processing" | "done" | "error";

	let status = $state<Status>("idle");
	let transcript = $state("");
	let error = $state("");
	let elapsed = $state<number | null>(null);
	let copied = $state(false);

	// Optimistic until mounted so prerendered HTML doesn't flash the "unsupported"
	// note before the client can feature-detect.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const supported = $derived(
		!mounted || isSpeechRecognitionSupported() || typeof transcribe === "function"
	);

	const session = new SpeechSession();
	const recording = new AudioRecorder();
	let request: AbortController | undefined;
	let startedAt = 0;
	// Bumped on every start/stop so a stop issued while getUserMedia() is still
	// resolving invalidates that startup and the late stream is released instead
	// of recording in the background with the UI already marked done.
	let recordToken = 0;

	const isRecording = $derived(status === "recording");
	const isProcessing = $derived(status === "processing");

	function teardownStream() {
		recording.cancel();
	}

	async function start() {
		request?.abort();
		request = new AbortController();
		error = "";
		transcript = "";
		elapsed = null;
		startedAt = Date.now();
		status = "recording";
		const token = ++recordToken;

		try {
			if (transcribe) {
				await recording.start();
				if (token !== recordToken) {
					recording.cancel();
					return;
				}
			} else {
				// Demo: browser Web Speech API, no audio upload needed.
				session.start("en-US", {
					onError: (err) => fail(err.message),
				});
			}
		} catch (err) {
			if (token === recordToken) {
				fail(err instanceof Error ? err.message : "Could not access the microphone.");
			}
		}
	}

	async function stop() {
		// Invalidate any in-flight startup so a not-yet-ready recorder bails out.
		const token = ++recordToken;
		elapsed = (Date.now() - startedAt) / 1000;
		status = "processing";
		try {
			if (transcribe) {
				const audio = await recording.stop();
				if (token !== recordToken) return;
				const text = await transcribe(audio, request?.signal);
				if (token !== recordToken) return;
				transcript = text.trim();
			} else {
				await session.stop();
				transcript = session.committed.trim();
			}
			status = "done";
		} catch (err) {
			fail(err instanceof Error ? err.message : "Transcription failed.");
		}
	}

	function fail(message: string) {
		error = message;
		status = "error";
		session.abort();
		teardownStream();
	}

	function toggle() {
		if (!supported) return;
		if (isRecording) void stop();
		else if (status !== "processing") void start();
	}

	function onKeydown(event: KeyboardEvent) {
		// ⌥Space (Alt+Space) toggles recording — but not while typing in a field.
		const target = event.target as HTMLElement | null;
		if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable)
			return;
		if (event.altKey && event.code === "Space") {
			event.preventDefault();
			toggle();
		}
	}

	async function copy() {
		if (!transcript) return;
		try {
			await navigator.clipboard.writeText(transcript);
		} catch {
			return; // clipboard blocked (insecure context / denied) — leave UI untouched
		}
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	onDestroy(() => {
		++recordToken;
		request?.abort();
		session.abort();
		teardownStream();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div data-slot="transcriber-01" class={cn(ui.root(), className)}>
	<Card class="border-border relative m-0 gap-0 overflow-hidden p-0 shadow-2xl">
		<div class={ui.content()}>
			<div class={ui.stage()}>
				{#if status === "done" || status === "error"}
					<div class="relative w-full max-w-2xl px-6">
						<ScrollArea class={ui.scroll()}>
							<div class={ui.result()}>
								{#if error}<p class={ui.errorText()}>{error}</p>
								{:else if transcript}<Response content={transcript} />
								{:else}<p class={ui.emptyText()}>No speech detected. Try again.</p>{/if}
							</div>
						</ScrollArea>
						{#if transcript && !error}
							<Button
								variant="ghost"
								size="icon"
								class={ui.copyButton()}
								onclick={copy}
								aria-label="Copy transcript"
							>
								{#if copied}<CheckIcon class="size-3.5" />{:else}<CopyIcon class="size-3.5" />{/if}
							</Button>
						{/if}
					</div>
				{:else}
					<LiveWaveform
						active={isRecording}
						getLevel={transcribe ? recording.getLevel : undefined}
						processing={isProcessing}
						barWidth={isProcessing ? 4 : 5}
						barGap={isProcessing ? 1 : 2}
						barRadius={8}
						barColor="#71717a"
						fadeEdges
						fadeWidth={48}
						sensitivity={0.8}
						smoothingTimeConstant={0.85}
						class={cn(ui.waveform(), isProcessing && "opacity-60")}
					/>
				{/if}
			</div>
		</div>
		<Separator />
		<div class={ui.toolbar()}>
			<span class={cn(ui.timer(), elapsed === null && !error && "opacity-0")}>
				{error ? "Error" : `${(elapsed ?? 0).toFixed(2)}s`}
			</span>
			<Button
				onclick={toggle}
				disabled={!supported || isProcessing}
				variant="outline"
				size="sm"
				class="gap-2"
				aria-label={isRecording ? "Stop recording" : "Start recording"}
			>
				{isRecording || isProcessing ? "Stop" : "Record"}
				<kbd class={ui.kbd()}><span class="text-xs">⌥</span>Space</kbd>
			</Button>
		</div>
		{#if !supported}
			<p class={ui.note()}>
				This demo uses the browser Web Speech API (Chromium-based browsers). Pass a <code
					class={ui.code()}>transcribe</code
				> function to wire any provider.
			</p>
		{/if}
	</Card>
</div>
