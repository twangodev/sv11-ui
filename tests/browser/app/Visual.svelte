<script lang="ts">
	import { ModeWatcher } from "mode-watcher";
	import { Orb } from "../../../src/lib/registry/ui/orb/index.js";
	import { Waveform } from "../../../src/lib/registry/ui/waveform/index.js";
	import { LiveWaveform } from "../../../src/lib/registry/ui/live-waveform/index.js";
	import { ShimmeringText } from "../../../src/lib/registry/ui/shimmering-text/index.js";
	import * as Audio from "../../../src/lib/registry/ui/audio-player/index.js";
	import * as Message from "../../../src/lib/registry/ui/message/index.js";
	import * as Conversation from "../../../src/lib/registry/ui/conversation/index.js";
	import { Response } from "../../../src/lib/registry/ui/response/index.js";
	import { BarVisualizer } from "../../../src/lib/registry/ui/bar-visualizer/index.js";
	import { Matrix } from "../../../src/lib/registry/ui/matrix/index.js";
	import { VoicePicker } from "../../../src/lib/registry/ui/voice-picker/index.js";
	import { VoiceButton } from "../../../src/lib/registry/ui/voice-button/index.js";
	import { ConversationBar } from "../../../src/lib/registry/ui/conversation-bar/index.js";
	import { MicSelector } from "../../../src/lib/registry/ui/mic-selector/index.js";
	import * as Transcript from "../../../src/lib/registry/ui/transcript-viewer/index.js";
	import * as Scrub from "../../../src/lib/registry/ui/scrub-bar/index.js";
	import * as Speech from "../../../src/lib/registry/ui/speech-input/index.js";
	import type { Component } from "svelte";
	import type {
		ConversationAdapter,
		TranscriptionAdapter,
	} from "../../../src/lib/registry/ui/voice-session/types.js";
	const adapter: ConversationAdapter = {
		async connect(config) {
			config.onConnect();
		},
		disconnect() {},
		sendMessage() {},
		sendContextualUpdate() {},
		setMuted() {},
	};

	const transcription: TranscriptionAdapter = {
		async start(callbacks) {
			callbacks.onConnect?.();
		},
		stop() {},
		cancel() {},
	};
	const params = new URL(location.href).searchParams;
	const name = params.get("component") ?? "orb";
	const theme = params.get("theme") === "dark" ? "dark" : "light";
	const blocks = import.meta.glob("../../../src/lib/registry/blocks/*/index.ts");
	const block = name.startsWith("block-") ? name.slice(6) : undefined;
	const blockProps = {
		...(block === "pong-01" ? { heartbeat: async () => 1 } : {}),
		...(block === "voice-nav-01" ? { initialUrl: "https://elevenlabs.io/docs" } : {}),
		...(block?.startsWith("voice-chat-") ? { adapter } : {}),
		transcribe: async () => "Fixture transcript",
		extractFields: async () => ({ firstName: "Grace" }),
	};
	const loadBlock = block
		? blocks[`../../../src/lib/registry/blocks/${block}/index.ts`]
		: undefined;
	const samples = Array.from({ length: 80 }, (_, i) => 0.12 + Math.abs(Math.sin(i * 0.45)) * 0.75);
	const pattern = Array.from({ length: 7 }, (_, row) =>
		Array.from({ length: 7 }, (_, col) => (row === col || row + col === 6 ? 1 : 0))
	);
	const text = "Hello world. This is a timed transcript.";
	const alignment = {
		characters: text.split(""),
		characterStartTimesSeconds: [...text].map((_, i) => i * 0.1),
		characterEndTimesSeconds: [...text].map((_, i) => (i + 1) * 0.1),
	};
	const markdown =
		"Hello **world**. Here is a [link](https://example.com).\n\n- First item\n- Second item\n\n> A useful quote.";
	let value = $state(30);
</script>

<ModeWatcher defaultMode={theme} disableTransitions />
<main class="mx-auto w-full max-w-3xl p-8" data-testid="visual-stage" data-component={name}>
	{#if loadBlock}
		{#await loadBlock() then module}
			{@const Block = (module as { default: Component }).default}
			<Block {...blockProps} />
		{/await}
	{:else if name === "orb"}
		<div class="mx-auto size-48">
			<Orb seed={1000} volumeMode="manual" manualInput={0} manualOutput={0} />
		</div>
	{:else if name === "waveform"}
		<Waveform data={samples} height={80} />
	{:else if name === "live-waveform"}
		<LiveWaveform height={80} active={false} />
	{:else if name === "shimmering-text"}
		<ShimmeringText text="Listening to your voice" repeat={false} duration={0} />
	{:else if name === "audio-player"}
		<Audio.Root
			><div class="flex items-center gap-3">
				<Audio.Button /><Audio.Time /><Audio.Progress class="flex-1" /><Audio.Duration
				/><Audio.Speed />
			</div></Audio.Root
		>
	{:else if name === "message"}
		<div class="space-y-4">
			<Message.Root from="user"
				><Message.Content>How can I build a voice agent?</Message.Content></Message.Root
			><Message.Root from="assistant"
				><Message.Content>Choose your provider and connect an adapter.</Message.Content
				></Message.Root
			>
		</div>
	{:else if name === "conversation"}
		<div class="h-80 rounded-xl border">
			<Conversation.Root
				><Conversation.Content
					><Conversation.EmptyState
						title="Start a conversation"
						description="Type a message to begin"
					/></Conversation.Content
				></Conversation.Root
			>
		</div>
	{:else if name === "response"}
		<Response content={markdown} />
	{:else if name === "bar-visualizer"}
		<BarVisualizer barCount={15} />
	{:else if name === "matrix"}
		<div class="flex justify-center"><Matrix rows={7} cols={7} {pattern} /></div>
	{:else if name === "voice-picker"}
		<VoicePicker
			voices={[
				{ id: "rachel", name: "Rachel", labels: { gender: "female", accent: "american" } },
				{ id: "drew", name: "Drew", labels: { gender: "male", accent: "american" } },
			]}
		/>
	{:else if name === "voice-button"}
		<div class="flex flex-wrap gap-4">
			<VoiceButton label="Voice input" trailing="⌥Space" /><VoiceButton
				label="Processing"
				state="processing"
			/><VoiceButton label="Success" state="success" feedbackDuration={60000} /><VoiceButton
				label="Error"
				state="error"
				feedbackDuration={60000}
			/>
		</div>
	{:else if name === "conversation-bar"}
		<ConversationBar {adapter} />
	{:else if name === "mic-selector"}
		<MicSelector />
	{:else if name === "transcript-viewer"}
		<Transcript.Root
			{alignment}
			audioSrc="/audio/transcript-viewer.wav"
			class="rounded-xl border p-4"
			><Transcript.Audio class="sr-only" /><Transcript.Words /><Transcript.ScrubBar
			/><Transcript.PlayPauseButton size="default" class="w-full">Play</Transcript.PlayPauseButton
			></Transcript.Root
		>
	{:else if name === "scrub-bar"}
		<Scrub.Root duration={100} {value} onScrub={(next) => (value = next)}
			><Scrub.TimeLabel time={value} class="w-10 text-center" /><Scrub.Track class="mx-2"
				><Scrub.Progress /><Scrub.Thumb class="bg-primary" /></Scrub.Track
			><Scrub.TimeLabel time={100} class="w-10 text-center" /></Scrub.Root
		>
	{:else if name === "speech-input"}
		<Speech.Root adapter={transcription}
			><Speech.CancelButton /><Speech.Preview placeholder="Listening..." /><Speech.RecordButton
			/></Speech.Root
		>
	{/if}
</main>
