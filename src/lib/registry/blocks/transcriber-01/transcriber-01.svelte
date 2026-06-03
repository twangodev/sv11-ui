<script lang="ts" module>
	import { tv } from "tailwind-variants";

	export const transcriber01Variants = tv({
		slots: {
			root: "mx-auto w-full max-w-xl",
			content: "flex flex-col gap-4",
			stage:
				"bg-muted/40 relative flex h-32 items-center justify-center overflow-hidden rounded-lg border",
			scroll: "h-full w-full",
			result: "p-4 text-sm",
			errorText: "text-destructive",
			emptyText: "text-muted-foreground",
			copyButton: "absolute top-2 right-2 size-7",
			waveform: "h-full w-full",
			toolbar: "flex items-center justify-between gap-3",
			timer: "text-muted-foreground font-mono text-xs tabular-nums",
			kbd: "bg-muted text-muted-foreground ms-1 hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:inline",
			note: "text-muted-foreground text-xs",
			code: "bg-muted rounded px-1 py-0.5",
		},
	});

	export type Transcriber01Props = {
		/**
		 * Provider-agnostic transcription backend. Receives the recorded audio
		 * and resolves with the transcript text. When omitted, the block uses the
		 * browser Web Speech API as a zero-backend demo (Chromium only).
		 */
		transcribe?: (audio: Blob) => Promise<string>;
		class?: string;
	};
</script>

<script lang="ts">
	import CopyIcon from "@lucide/svelte/icons/copy";
	import CheckIcon from "@lucide/svelte/icons/check";
	import MicIcon from "@lucide/svelte/icons/mic";
	import SquareIcon from "@lucide/svelte/icons/square";
	import { onDestroy, onMount } from "svelte";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
	} from "$lib/registry/ui/card/index.js";
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
	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];
	let stream: MediaStream | null = null;
	let startedAt = 0;
	// Bumped on every start/stop so a stop issued while getUserMedia() is still
	// resolving invalidates that startup and the late stream is released instead
	// of recording in the background with the UI already marked done.
	let recordToken = 0;

	const isRecording = $derived(status === "recording");
	const isProcessing = $derived(status === "processing");

	function teardownStream() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		mediaRecorder = null;
		chunks = [];
	}

	async function start() {
		error = "";
		transcript = "";
		elapsed = null;
		startedAt = Date.now();
		status = "recording";
		const token = ++recordToken;

		try {
			if (transcribe) {
				// Real backend: capture audio for the adapter to transcribe.
				const captured = await navigator.mediaDevices.getUserMedia({ audio: true });
				if (token !== recordToken) {
					// Stopped before the recorder was ready — release the late stream.
					captured.getTracks().forEach((t) => t.stop());
					return;
				}
				stream = captured;
				const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
					? "audio/webm;codecs=opus"
					: "audio/webm";
				chunks = [];
				mediaRecorder = new MediaRecorder(stream, { mimeType });
				mediaRecorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
				mediaRecorder.start();
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
		recordToken++;
		elapsed = (Date.now() - startedAt) / 1000;
		status = "processing";
		try {
			if (transcribe) {
				if (mediaRecorder) {
					const blob = await new Promise<Blob>((resolve) => {
						mediaRecorder!.onstop = () =>
							resolve(new Blob(chunks, { type: mediaRecorder!.mimeType }));
						mediaRecorder!.stop();
					});
					teardownStream();
					transcript = (await transcribe(blob)).trim();
				} else {
					// Stopped before getUserMedia()/MediaRecorder were ready — nothing captured.
					teardownStream();
					transcript = "";
				}
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
		// ⌥Space (Alt+Space) toggles recording.
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
		session.abort();
		teardownStream();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<Card class={cn(ui.root(), className)}>
	<CardHeader>
		<CardTitle>Transcriber</CardTitle>
		<CardDescription>Record a clip and transcribe it to text.</CardDescription>
	</CardHeader>
	<CardContent class={ui.content()}>
		<div class={ui.stage()}>
			{#if status === "done" || status === "error"}
				<ScrollArea class={ui.scroll()}>
					<div class={ui.result()}>
						{#if error}
							<p class={ui.errorText()}>{error}</p>
						{:else if transcript}
							<Response content={transcript} />
						{:else}
							<p class={ui.emptyText()}>No speech detected. Try again.</p>
						{/if}
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
			{:else}
				<LiveWaveform
					active={isRecording}
					processing={isProcessing}
					barColor="#71717a"
					fadeEdges
					sensitivity={0.8}
					class={cn(ui.waveform(), isProcessing && "opacity-60")}
				/>
			{/if}
		</div>

		<Separator />

		<div class={ui.toolbar()}>
			<span class={ui.timer()}>
				{#if status === "error"}
					Error
				{:else if elapsed !== null}
					{elapsed.toFixed(2)}s
				{:else}
					&nbsp;
				{/if}
			</span>
			<Button
				onclick={toggle}
				disabled={!supported || isProcessing}
				variant={isRecording ? "secondary" : "default"}
			>
				{#if isRecording}
					<SquareIcon class="size-4" /> Stop
				{:else}
					<MicIcon class="size-4" /> {isProcessing ? "Transcribing…" : "Record"}
				{/if}
				<kbd class={ui.kbd()}>⌥Space</kbd>
			</Button>
		</div>

		{#if !supported}
			<p class={ui.note()}>
				This demo uses the browser Web Speech API (Chromium-based browsers). Pass a
				<code class={ui.code()}>transcribe</code> function to wire any provider.
			</p>
		{/if}
	</CardContent>
</Card>
