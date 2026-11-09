<script lang="ts">
	import { onDestroy } from "svelte";
	import { AudioRecorder } from "$lib/registry/ui/voice-session/recording.js";
	import type { TranscribeAudio, ExtractFields } from "$lib/registry/ui/voice-session/types.js";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/registry/ui/card/index.js";
	import { Input } from "$lib/registry/ui/input/index.js";
	import { Label } from "$lib/registry/ui/label/index.js";
	import { VoiceButton, type VoiceButtonState } from "$lib/registry/ui/voice-button/index.js";
	import { validateExampleForm, type ExampleFormValues } from "./schema.js";

	let {
		values = $bindable({ firstName: "", lastName: "" }),
		transcribe,
		extractFields,
		onValuesChange,
		class: className,
	}: {
		values?: ExampleFormValues;
		transcribe?: TranscribeAudio;
		extractFields?: ExtractFields<ExampleFormValues>;
		onValuesChange?: (values: ExampleFormValues) => void;
		class?: string;
	} = $props();
	const errors = $derived(validateExampleForm(values));
	const recorder = new AudioRecorder();
	let voiceState = $state<VoiceButtonState>("idle");
	let error = $state("");
	type RecordingAttempt = {
		controller: AbortController;
		transcribe: TranscribeAudio;
		extractFields: ExtractFields<ExampleFormValues>;
	};
	let activeRecording = $state.raw<RecordingAttempt>();
	let feedback: ReturnType<typeof setTimeout> | undefined;
	const isCurrent = (attempt: RecordingAttempt) =>
		activeRecording === attempt && !attempt.controller.signal.aborted;

	function cancelRecording() {
		activeRecording?.controller.abort();
		activeRecording = undefined;
		recorder.cancel();
		clearTimeout(feedback);
	}

	$effect(() => {
		if ((!transcribe || !extractFields) && activeRecording) {
			cancelRecording();
			voiceState = "idle";
		}
	});

	async function handleVoiceToggle() {
		if (voiceState === "processing") return;
		if (voiceState === "recording" && activeRecording) {
			const current = activeRecording;
			voiceState = "processing";
			try {
				const audio = await recorder.stop();
				if (!isCurrent(current)) return;
				const transcript = await current.transcribe(audio, current.controller.signal);
				if (!isCurrent(current)) return;
				const fields = await current.extractFields(transcript, current.controller.signal);
				if (!isCurrent(current)) return;
				values = {
					firstName: typeof fields.firstName === "string" ? fields.firstName : values.firstName,
					lastName: typeof fields.lastName === "string" ? fields.lastName : values.lastName,
				};
				onValuesChange?.(values);
				voiceState = "success";
			} catch (cause) {
				if (isCurrent(current)) {
					error = cause instanceof Error ? cause.message : "Voice fill failed.";
					voiceState = "error";
				}
			} finally {
				if (isCurrent(current))
					feedback = setTimeout(() => {
						if (isCurrent(current)) {
							activeRecording = undefined;
							voiceState = "idle";
						}
					}, 1800);
			}
			return;
		}
		if (!transcribe || !extractFields) return;
		cancelRecording();
		const current: RecordingAttempt = {
			controller: new AbortController(),
			transcribe,
			extractFields,
		};
		activeRecording = current;
		error = "";
		voiceState = "recording";
		try {
			await recorder.start();
		} catch (cause) {
			if (isCurrent(current)) {
				error = cause instanceof Error ? cause.message : "Could not record audio.";
				voiceState = "error";
			}
		}
	}
	onDestroy(cancelRecording);

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
	}
</script>

<div data-slot="voice-form-01" class={className}>
	<Card class="relative overflow-hidden">
		<div class="flex flex-col gap-2">
			<CardHeader>
				<div class="flex items-start justify-between">
					<div class="space-y-1">
						<CardTitle>Voice Fill</CardTitle>
						<CardDescription>Fill fields by voice</CardDescription>
					</div>
					<VoiceButton
						state={voiceState}
						onPress={handleVoiceToggle}
						disabled={!transcribe || !extractFields || voiceState === "processing"}
						getLevel={recorder.getLevel}
						trailing="Voice Fill"
					/>
				</div>
			</CardHeader>
			<CardContent>
				{#if error}<p role="alert" class="text-destructive text-sm">{error}</p>{/if}
				<form onsubmit={onSubmit} class="space-y-6">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="voice-form-01-first-name">First Name *</Label>
							<Input
								id="voice-form-01-first-name"
								placeholder="John"
								bind:value={values.firstName}
								aria-invalid={errors.firstName ? "true" : undefined}
								aria-describedby={errors.firstName ? "voice-form-01-first-name-error" : undefined}
							/>
							{#if errors.firstName}
								<p
									id="voice-form-01-first-name-error"
									class="text-destructive text-sm"
									role="alert"
								>
									{errors.firstName}
								</p>
							{/if}
						</div>
						<div class="space-y-2">
							<Label for="voice-form-01-last-name">Last Name *</Label>
							<Input
								id="voice-form-01-last-name"
								placeholder="Doe"
								bind:value={values.lastName}
								aria-invalid={errors.lastName ? "true" : undefined}
								aria-describedby={errors.lastName ? "voice-form-01-last-name-error" : undefined}
							/>
							{#if errors.lastName}
								<p id="voice-form-01-last-name-error" class="text-destructive text-sm" role="alert">
									{errors.lastName}
								</p>
							{/if}
						</div>
					</div>
				</form>
			</CardContent>
		</div>
	</Card>
</div>
