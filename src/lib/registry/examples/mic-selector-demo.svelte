<script lang="ts">
	import Disc from "@lucide/svelte/icons/disc";
	import Pause from "@lucide/svelte/icons/pause";
	import Play from "@lucide/svelte/icons/play";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card } from "$lib/registry/ui/card/index.js";
	import { LiveWaveform } from "$lib/registry/ui/live-waveform/index.js";
	import { MicSelector } from "$lib/registry/ui/mic-selector/index.js";
	import { Separator } from "$lib/registry/ui/separator/index.js";
	import { cn } from "$lib/utils.js";

	type RecordingState = "idle" | "loading" | "recording" | "recorded" | "playing";

	let selectedDevice = $state("");
	let isMuted = $state(false);
	let recordingState = $state<RecordingState>("idle");
	let audioBlob = $state<Blob | null>(null);

	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let audioElement: HTMLAudioElement | null = null;

	async function startRecording() {
		try {
			recordingState = "loading";

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
			});

			const recorder = new MediaRecorder(stream);
			mediaRecorder = recorder;
			audioChunks = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks.push(event.data);
				}
			};

			recorder.onstop = () => {
				const blob = new Blob(audioChunks, { type: "audio/webm" });
				audioBlob = blob;
				stream.getTracks().forEach((track) => track.stop());
				recordingState = "recorded";
			};

			recorder.start();
			recordingState = "recording";
		} catch (error) {
			console.error("Error starting recording:", error);
			recordingState = "idle";
		}
	}

	function stopRecording() {
		if (mediaRecorder && recordingState === "recording") {
			mediaRecorder.stop();
		}
	}

	function playRecording() {
		if (!audioBlob) return;

		const audio = new Audio(URL.createObjectURL(audioBlob));
		audioElement = audio;

		audio.onended = () => {
			recordingState = "recorded";
		};

		audio.play();
		recordingState = "playing";
	}

	function pausePlayback() {
		if (audioElement) {
			audioElement.pause();
			recordingState = "recorded";
		}
	}

	function restart() {
		if (audioElement) {
			audioElement.pause();
			audioElement = null;
		}
		audioBlob = null;
		audioChunks = [];
		recordingState = "idle";
	}

	// Stop recording when muted
	$effect(() => {
		if (isMuted && recordingState === "recording") {
			stopRecording();
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			if (mediaRecorder) {
				mediaRecorder.stop();
			}
			if (audioElement) {
				audioElement.pause();
			}
		};
	});

	const showWaveform = $derived(recordingState === "recording" && !isMuted);
	const showProcessing = $derived(recordingState === "loading" || recordingState === "playing");
	const showRecorded = $derived(recordingState === "recorded");
</script>

<div class="flex min-h-[200px] w-full items-center justify-center p-4">
	<Card class="m-0 w-full max-w-2xl border p-0 shadow-lg">
		<div class="flex w-full flex-wrap items-center justify-between gap-2 p-2">
			<div class="h-8 w-full min-w-0 flex-1 md:w-[200px] md:flex-none">
				<div
					class="bg-foreground/5 text-foreground/70 flex h-full items-center gap-2 rounded-md py-1"
				>
					<div class="h-full min-w-0 flex-1">
						<div
							class="relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden rounded-sm"
						>
							{#key recordingState}
								<LiveWaveform
									active={showWaveform}
									processing={showProcessing}
									deviceId={selectedDevice}
									barWidth={3}
									barGap={1}
									barRadius={4}
									fadeEdges={true}
									fadeWidth={24}
									sensitivity={1.8}
									smoothingTimeConstant={0.85}
									height={20}
									mode="scrolling"
									class={cn(
										"h-full w-full transition-opacity duration-300",
										recordingState === "idle" && "opacity-0"
									)}
								/>
							{/key}
							{#if recordingState === "idle"}
								<div class="absolute inset-0 flex items-center justify-center">
									<span class="text-foreground/50 text-xs font-medium">Start Recording</span>
								</div>
							{/if}
							{#if showRecorded}
								<div class="absolute inset-0 flex items-center justify-center">
									<span class="text-foreground/50 text-xs font-medium">Ready to Play</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
			<div class="flex w-full flex-wrap items-center justify-center gap-1 md:w-auto">
				<MicSelector
					value={selectedDevice}
					onValueChange={(v) => (selectedDevice = v)}
					muted={isMuted}
					onMutedChange={(m) => (isMuted = m)}
					disabled={recordingState === "recording" || recordingState === "loading"}
				/>
				<Separator orientation="vertical" class="mx-1 -my-2.5" />
				<div class="flex">
					{#if recordingState === "idle"}
						<Button
							variant="ghost"
							size="icon"
							onclick={startRecording}
							disabled={isMuted}
							aria-label="Start recording"
						>
							<Disc class="size-5" />
						</Button>
					{/if}
					{#if recordingState === "loading" || recordingState === "recording"}
						<Button
							variant="ghost"
							size="icon"
							onclick={stopRecording}
							disabled={recordingState === "loading"}
							aria-label="Stop recording"
						>
							<Pause class="size-5" />
						</Button>
					{/if}
					{#if showRecorded}
						<Button variant="ghost" size="icon" onclick={playRecording} aria-label="Play recording">
							<Play class="size-5" />
						</Button>
					{/if}
					{#if recordingState === "playing"}
						<Button variant="ghost" size="icon" onclick={pausePlayback} aria-label="Pause playback">
							<Pause class="size-5" />
						</Button>
					{/if}
					<Separator orientation="vertical" class="mx-1 -my-2.5" />
					<Button
						variant="ghost"
						size="icon"
						onclick={restart}
						disabled={recordingState === "idle" ||
							recordingState === "loading" ||
							recordingState === "recording"}
						aria-label="Delete recording"
					>
						<Trash2 class="size-5" />
					</Button>
				</div>
			</div>
		</div>
	</Card>
</div>
