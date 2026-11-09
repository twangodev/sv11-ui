import { Room, RoomEvent, Track, type RoomConnectOptions } from "livekit-client";
import type { AgentActivity, ConversationAdapter } from "../types.js";

export interface LiveKitConversationOptions {
	/** Use a dedicated room; this adapter attaches remote audio and owns its connection. */
	room?: Room;
	connect: () => Promise<{ url: string; token: string; options?: RoomConnectOptions }>;
	agentIdentity?: string;
	/** Application-defined RPC or data protocol, if the agent supports it. */
	updateContext?: (room: Room, text: string) => Promise<void>;
	interrupt?: (room: Room) => Promise<void>;
}
export function createLiveKitConversation(
	options: LiveKitConversationOptions
): ConversationAdapter {
	const room = options.room ?? new Room();
	let generation = 0;
	let cleanup: (() => void)[] = [];
	const elements = new Set<HTMLMediaElement>();
	const streams = new Map<string, { streamId: string; final: boolean }>();
	const agent = () =>
		[...room.remoteParticipants.values()].find((p) =>
			options.agentIdentity ? p.identity === options.agentIdentity : p.isAgent
		);
	return {
		capabilities: {
			text: true,
			context: !!options.updateContext,
			mute: true,
			inputDevice: true,
			interrupt: !!options.interrupt,
			audioLevels: true,
		},
		async connect(config) {
			const id = ++generation;
			const current = () => id === generation && !config.signal?.aborted;
			const disconnected = () => config.onDisconnect();
			room.on(RoomEvent.Disconnected, disconnected);
			cleanup.push(() => room.off(RoomEvent.Disconnected, disconnected));
			const attributes = () => {
				const state = agent()?.attributes["lk.agent.state"];
				if (state === "listening" || state === "thinking" || state === "speaking")
					config.onActivityChange?.(state as AgentActivity);
			};
			room.on(RoomEvent.ParticipantAttributesChanged, attributes);
			cleanup.push(() => room.off(RoomEvent.ParticipantAttributesChanged, attributes));
			const attach = (track: import("livekit-client").RemoteTrack) => {
				if (track.kind !== Track.Kind.Audio) return;
				const element = track.attach();
				elements.add(element);
				void element.play().catch((error) => config.onError(error));
			};
			room.on(RoomEvent.TrackSubscribed, attach);
			cleanup.push(() => room.off(RoomEvent.TrackSubscribed, attach));
			for (const topic of ["lk.transcription", "lk.chat"]) {
				room.registerTextStreamHandler(topic, async (reader, participant) => {
					let text = "";
					const attributes = reader.info.attributes;
					const segment = attributes?.["lk.segment_id"] ?? reader.info.id;
					const messageId = `livekit-${id}-${participant.identity}-${attributes?.["lk.transcribed_track_id"] ?? "text"}-${segment}`;
					const final = attributes?.["lk.transcription_final"] !== "false";
					if (streams.get(messageId)?.final && !final) return;
					streams.set(messageId, { streamId: reader.info.id, final });
					const latest = () => current() && streams.get(messageId)?.streamId === reader.info.id;
					const source = participant.identity === room.localParticipant.identity ? "user" : "ai";
					try {
						for await (const chunk of reader) {
							if (!latest()) return;
							text += chunk;
							config.onMessage({ id: messageId, source, message: text, final: false });
						}
						if (latest()) config.onMessage({ id: messageId, source, message: text, final });
					} catch (error) {
						if (current())
							config.onError(error instanceof Error ? error : new Error(String(error)));
					}
				});
				cleanup.push(() => room.unregisterTextStreamHandler(topic));
			}
			const credentials = await options.connect();
			if (!current()) return;
			await room.connect(credentials.url, credentials.token, credentials.options);
			if (!current()) {
				await room.disconnect();
				return;
			}
			await room.localParticipant.setMicrophoneEnabled(true);
			if (!current()) {
				await room.disconnect();
				return;
			}
			const microphone = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
			if (microphone) config.onInputStream?.(new MediaStream([microphone.mediaStreamTrack]));
			config.onConnect();
			attributes();
		},
		async disconnect() {
			++generation;
			cleanup.forEach((fn) => fn());
			cleanup = [];
			for (const element of elements) {
				element.pause();
				element.srcObject = null;
				element.remove();
			}
			elements.clear();
			streams.clear();
			await room.disconnect();
		},
		async sendMessage(text) {
			await room.localParticipant.sendText(text, { topic: "lk.chat" });
		},
		async sendContextualUpdate(text) {
			if (!options.updateContext) throw new Error("Configure updateContext for this agent.");
			await options.updateContext(room, text);
		},
		async setMuted(muted) {
			await room.localParticipant.setMicrophoneEnabled(!muted);
		},
		async setInputDevice(id) {
			await room.switchActiveDevice("audioinput", id);
		},
		async interrupt() {
			if (!options.interrupt) throw new Error("Configure interrupt for this agent.");
			await options.interrupt(room);
		},
		getInputVolume: () => room.localParticipant.audioLevel,
		getOutputVolume: () => agent()?.audioLevel ?? 0,
	};
}
