<script lang="ts">
	import CardsActivityGoal from "$lib/components/cards/activity-goal.svelte";
	import CardsBarVisualizer from "$lib/components/cards/bar-visualizer.svelte";
	import CardsLiveRecording from "$lib/components/cards/live-recording.svelte";
	import MusicPlayer01 from "$lib/registry/blocks/music-player-01/index.js";
	import MusicPlayer02 from "$lib/registry/blocks/music-player-02/index.js";
	import Speaker01 from "$lib/registry/blocks/speaker-01/index.js";
	import VoiceChat01 from "$lib/registry/blocks/voice-chat-01/index.js";
	import VoiceChat02 from "$lib/registry/blocks/voice-chat-02/index.js";
	import VoiceForm from "$lib/registry/blocks/voice-form-01/index.js";
	import ConversationDemo from "$lib/registry/examples/conversation-demo.svelte";
	import OrbDemo from "$lib/registry/examples/orb-demo.svelte";
	import VoicePickerDemo from "$lib/registry/examples/voice-picker-demo.svelte";
	import WaveformDemo from "$lib/registry/examples/waveform-demo.svelte";
	import { ConversationBar } from "$lib/registry/ui/conversation-bar/index.js";
</script>

<!--
	1:1 mirror of elevenlabs-ui/apps/www/components/cards/index.tsx.
	ConversationBar gets a canned no-op adapter since we don't have a real
	ElevenLabs agent wired up; the component renders the same but doesn't
	send anywhere.
-->
<div
	class="grid **:data-[slot=card]:shadow-none md:gap-4 lg:grid-cols-10 xl:grid-cols-11"
	data-slot="cards-demo"
>
	<div class="grid gap-4 lg:col-span-4 xl:col-span-6">
		<div class="grid gap-1 sm:grid-cols-[auto_1fr] md:hidden">
			<VoiceChat02 />
			<div class="pt-3 sm:pt-0 sm:pl-2 xl:pl-4">
				<CardsActivityGoal />
			</div>
		</div>
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
			<div class="flex flex-col gap-4">
				<CardsBarVisualizer />
				<VoiceForm />
				<OrbDemo small />
				<VoicePickerDemo />
				<WaveformDemo />
			</div>
			<div class="flex flex-col gap-4">
				<Speaker01 />
				<div class="lg:hidden xl:block">
					<ConversationDemo />
				</div>
			</div>
		</div>
	</div>
	<div class="flex flex-col gap-4 lg:col-span-6 xl:col-span-5">
		<div class="hidden gap-1 sm:grid-cols-2 md:grid">
			<VoiceChat02 />
			<div class="pt-3 sm:pt-0 sm:pl-2 xl:pl-3">
				<MusicPlayer02 />
				<div class="pt-3">
					<CardsLiveRecording />
				</div>
				<div class="pt-3">
					<ConversationBar
						adapter={{
							connect: async () => undefined,
							disconnect: () => undefined,
							sendMessage: () => undefined,
							sendContextualUpdate: () => undefined,
							setMuted: () => undefined,
						}}
						class="p-0"
					/>
				</div>
			</div>
			<div class="pt-3 sm:col-span-2 xl:pt-3">
				<MusicPlayer01 />
			</div>
		</div>
		<div class="hidden md:block">
			<VoiceChat01 />
		</div>
		<div class="hidden lg:block xl:hidden">
			<ConversationDemo />
		</div>
	</div>
</div>
