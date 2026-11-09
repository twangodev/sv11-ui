<script lang="ts">
	import { onDestroy } from "svelte";
	import Visual from "./Visual.svelte";
	import { ConversationSession } from "../../../src/lib/registry/ui/voice-session/session.js";
	import { useConversation } from "../../../src/lib/registry/ui/voice-session/use-conversation.svelte.js";
	import type {
		ConversationAdapter,
		ConversationConfig,
		TranscriptionAdapter,
		TranscriptionAdapterCallbacks,
	} from "../../../src/lib/registry/ui/voice-session/types.js";
	import VoiceChat01 from "../../../src/lib/registry/blocks/voice-chat-01/voice-chat-01.svelte";
	import VoiceChat02 from "../../../src/lib/registry/blocks/voice-chat-02/voice-chat-02.svelte";
	import VoiceChat03 from "../../../src/lib/registry/blocks/voice-chat-03/voice-chat-03.svelte";
	import VoiceForm01 from "../../../src/lib/registry/blocks/voice-form-01/voice-form-01.svelte";
	import VoiceNav01 from "../../../src/lib/registry/blocks/voice-nav-01/voice-nav-01.svelte";
	import Transcriber01 from "../../../src/lib/registry/blocks/transcriber-01/transcriber-01.svelte";
	import * as SpeechInput from "../../../src/lib/registry/ui/speech-input/index.js";
	import RealtimeTranscriber01 from "../../../src/lib/registry/blocks/realtime-transcriber-01/realtime-transcriber-01.svelte";
	import { Button } from "../../../src/lib/registry/ui/button/index.js";
	import { Orb } from "../../../src/lib/registry/ui/orb/index.js";

	const scenario = new URL(location.href).searchParams.get("scenario") ?? "chat";
	let connects = $state(0),
		disconnects = $state(0),
		backend = $state("A"),
		shown = $state(true);
	function adapter(name: string): ConversationAdapter {
		let config: ConversationConfig;
		return {
			capabilities: { text: true, context: false, mute: true, audioLevels: true },
			async connect(next) {
				config = next;
				connects++;
				next.onConnect();
			},
			disconnect() {
				disconnects++;
			},
			sendMessage(text) {
				config.onMessage({ id: `user-${text}`, source: "user", message: text, final: true });
				config.onMessage({
					id: `answer-${text}`,
					source: "ai",
					message: `${name}: partial`,
					final: false,
				});
				config.onMessage({
					id: `answer-${text}`,
					source: "ai",
					message: `${name}: ${text}`,
					final: true,
				});
			},
			sendContextualUpdate() {
				throw new Error("Unsupported context");
			},
			setMuted() {},
			getInputVolume: () => 0.25,
			getOutputVolume: () => 0.5,
		};
	}
	let session = $state.raw(new ConversationSession(adapter("A")));
	const voice = useConversation(() => session);
	async function switchBackend() {
		await session.dispose();
		backend = "B";
		session = new ConversationSession(adapter("B"));
	}
	onDestroy(() => {
		void session.dispose();
	});
	let speechCallbacks: TranscriptionAdapterCallbacks;
	let stopped = $state("");
	const transcription: TranscriptionAdapter = {
		async start(callbacks) {
			speechCallbacks = callbacks;
			callbacks.onConnect?.();
			callbacks.onPartialTranscript?.("hel");
		},
		async stop() {
			await new Promise((resolve) => setTimeout(resolve, 30));
			speechCallbacks.onCommittedTranscript?.("hello finalized");
		},
		cancel() {},
	};
	let values = $state({ firstName: "", lastName: "Existing" });
	let orbSize = $state(120),
		orbSeed = $state(1);
</script>

{#if scenario === "visual"}
	<Visual />
{:else}
	<main class="mx-auto max-w-4xl space-y-6 p-4">
		{#if scenario === "chat"}
			<div class="flex flex-wrap gap-2">
				<Button onclick={switchBackend}>Switch backend</Button>
				<Button onclick={() => (shown = !shown)}>Toggle card</Button>
				<Button onclick={() => session.setMuted(!voice.snapshot.muted)}>Toggle mute</Button>
			</div>
			<output data-testid="status">{voice.snapshot.status}</output>
			<output data-testid="counts">{connects}:{disconnects}:{backend}</output>
			<output data-testid="muted">{String(voice.snapshot.muted)}</output>
			{#if shown}<VoiceChat01 {session} />{/if}
			<VoiceChat02 {session} />
			<VoiceChat03 {session} />
		{:else if scenario === "speech"}
			<SpeechInput.Root adapter={transcription} onStop={(data) => (stopped = data.transcript)}>
				<SpeechInput.RecordButton /><SpeechInput.Preview /><SpeechInput.CancelButton />
			</SpeechInput.Root>
			<output data-testid="stopped">{stopped}</output>
		{:else if scenario === "realtime"}
			<RealtimeTranscriber01 adapter={transcription} />
		{:else if scenario === "form"}
			<VoiceForm01
				bind:values
				transcribe={async () => "My first name is Grace"}
				extractFields={async () => ({ firstName: "Grace" })}
			/>
			<output data-testid="values">{JSON.stringify(values)}</output>
		{:else if scenario === "navigation"}
			<VoiceNav01
				initialUrl="/"
				transcribe={async () => "show the destination"}
				resolve={async () => "/destination"}
			/>
		{:else if scenario === "transcriber"}
			<Transcriber01 transcribe={async () => "recorded audio transcribed"} />
		{:else if scenario === "orb"}
			<Button
				onclick={() => {
					orbSize = 180;
					orbSeed = 2;
				}}>Resize orb</Button
			>
			<div data-testid="orb-container" style:width={`${orbSize}px`} style:height={`${orbSize}px`}>
				<Orb seed={orbSeed} resizeDebounce={40} />
			</div>
		{/if}
	</main>
{/if}
