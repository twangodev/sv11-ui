<script lang="ts">
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

	let values = $state<ExampleFormValues>({ firstName: "", lastName: "" });
	const errors = $derived(validateExampleForm(values));

	let voiceState = $state<VoiceButtonState>("idle");
	let cycleTimers: ReturnType<typeof setTimeout>[] = [];

	function clearTimers() {
		cycleTimers.forEach(clearTimeout);
		cycleTimers = [];
	}

	function handleVoiceToggle() {
		if (voiceState === "recording" || voiceState === "processing") {
			clearTimers();
			voiceState = "idle";
			return;
		}
		clearTimers();
		voiceState = "recording";
		cycleTimers.push(
			setTimeout(() => {
				voiceState = "processing";
			}, 2000)
		);
		cycleTimers.push(
			setTimeout(() => {
				values = { firstName: "John", lastName: "Doe" };
				voiceState = "success";
			}, 3000)
		);
		cycleTimers.push(
			setTimeout(() => {
				voiceState = "idle";
			}, 5000)
		);
	}

	$effect(() => {
		return () => clearTimers();
	});

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
	}
</script>

<div class="mx-auto w-full">
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
						disabled={voiceState === "processing"}
						trailing="Voice Fill"
					/>
				</div>
			</CardHeader>
			<CardContent>
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
