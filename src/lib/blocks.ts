import type { Component } from "svelte";
import MusicPlayer01 from "$lib/registry/blocks/music-player-01/index.js";
import MusicPlayer02 from "$lib/registry/blocks/music-player-02/index.js";
import Speaker01 from "$lib/registry/blocks/speaker-01/index.js";
import VoiceChat01 from "$lib/registry/blocks/voice-chat-01/index.js";
import VoiceChat02 from "$lib/registry/blocks/voice-chat-02/index.js";
import VoiceChat03 from "$lib/registry/blocks/voice-chat-03/index.js";
import VoiceForm01 from "$lib/registry/blocks/voice-form-01/index.js";

export type BlockEntry = {
	name: string;
	title: string;
	description: string;
	component: Component;
};

export const blocks: BlockEntry[] = [
	{
		name: "speaker-01",
		title: "Speaker 01",
		description:
			"Speaker-style music player with two audio-reactive Orbs, waveform, and volume slider.",
		component: Speaker01,
	},
	{
		name: "voice-chat-01",
		title: "Voice Chat 01",
		description: "Full voice-and-text chat card with Orb, scrollable conversation, and composer.",
		component: VoiceChat01,
	},
	{
		name: "voice-chat-02",
		title: "Voice Chat 02",
		description: "Compact call card with animated Orb, connection status, and call toggle.",
		component: VoiceChat02,
	},
	{
		name: "voice-chat-03",
		title: "Voice Chat 03",
		description:
			"Tall chat card: ConversationBar anchored at the bottom, empty-state Orb, and per-message copy buttons.",
		component: VoiceChat03,
	},
	{
		name: "music-player-01",
		title: "Music Player 01",
		description: "Music player with a scrollable song list and full transport controls.",
		component: MusicPlayer01,
	},
	{
		name: "music-player-02",
		title: "Music Player 02",
		description: "Minimal single-track player with play/pause, progress, and duration.",
		component: MusicPlayer02,
	},
	{
		name: "voice-form-01",
		title: "Voice Form 01",
		description: "Form with a voice-fill button that cycles through idle/recording/success states.",
		component: VoiceForm01,
	},
];

const byName = new Map(blocks.map((b) => [b.name, b]));

export function getBlock(name: string): BlockEntry | undefined {
	return byName.get(name);
}
