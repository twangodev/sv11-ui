---
title: Voice Button
description: Stateful button with integrated live waveform feedback for voice recording, success/error states, and keyboard shortcut slots.
component: true
links:
  source: https://github.com/twangodev/svagent-ui/tree/main/src/lib/registry/ui/voice-button
---

<ComponentPreview name="voice-button-demo" />

## Installation

<Install component="voice-button" />

## Usage

<Usage component="voice-button" />

## Examples

### Basic Usage

Drive the button through its lifecycle by passing a reactive `state`.

```svelte
<script lang="ts">
	import { VoiceButton, type VoiceButtonState } from "$lib/registry/ui/voice-button";

	let state = $state<VoiceButtonState>("idle");

	function handlePress() {
		if (state === "idle") {
			state = "recording";
		} else {
			state = "processing";
		}
	}
</script>

<VoiceButton {state} onPress={handlePress} />
```

### With Label and Keyboard Shortcut

Use `label` for leading text and `trailing` to surface a keyboard shortcut. The trailing slot is hidden while the waveform is active.

```svelte
<VoiceButton
	state="idle"
	label="Press to speak"
	trailing="⌥Space"
	onPress={() => console.log("Button pressed")}
/>
```

### Different States

Each state renders a distinct visual: the waveform activates on `recording`, continues through `processing`, and a check or X flashes for `success` and `error` before returning to idle visuals.

```svelte
<script lang="ts">
	import { VoiceButton } from "$lib/registry/ui/voice-button";
</script>

<VoiceButton state="idle" />
<VoiceButton state="recording" />
<VoiceButton state="processing" />
<VoiceButton state="success" />
<VoiceButton state="error" />
```

### Icon Button

Set `size="icon"` and pass an `icon` snippet for compact, icon-only layouts.

```svelte
<script lang="ts">
	import MicIcon from "@lucide/svelte/icons/mic";
	import { VoiceButton } from "$lib/registry/ui/voice-button";
</script>

<VoiceButton state="idle" size="icon">
	{#snippet icon()}
		<MicIcon />
	{/snippet}
</VoiceButton>
```

### Custom Styling

Merge extra classes onto the button with `class`, and onto the inner waveform container with `waveformClassName`.

```svelte
<VoiceButton
	state="recording"
	variant="default"
	size="lg"
	class="w-full"
	waveformClassName="bg-primary/10"
/>
```

### Auto-transitioning States

Chain state transitions from `onPress` to model a full record → process → success flow.

```svelte
<script lang="ts">
	import { VoiceButton, type VoiceButtonState } from "$lib/registry/ui/voice-button";

	let state = $state<VoiceButtonState>("idle");

	function handlePress() {
		if (state === "idle") {
			state = "recording";
		} else if (state === "recording") {
			state = "processing";
			setTimeout(() => {
				state = "success";
			}, 2000);
		}
	}
</script>

<VoiceButton {state} onPress={handlePress} />
```

## API Reference

<ComponentAPI component="voice-button" />

## Notes

- Built on top of the shadcn-svelte `Button` primitive, so every button `variant` and `size` — including `"icon"` — works as expected.
- The integrated [`LiveWaveform`](/docs/components/live-waveform) samples the active microphone stream directly while `state` is `"recording"` or `"processing"`.
- `success` and `error` auto-clear after `feedbackDuration` (default `1500`ms); drive `state` back to `"idle"` from your side on the same cadence if you want the button fully reset.
- While `state="processing"`, the button is rendered disabled regardless of the `disabled` prop.
- `onPress` fires after any `onclick` handler you pass — both are invoked.
