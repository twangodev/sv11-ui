import {
	Room,
	RoomEvent,
	Track,
	TrackEvent,
	type LocalTrack,
	type RemoteTrack,
	type RoomConnectOptions,
	type RoomEventCallbacks,
} from "livekit-client";
import type { AgentActivity, ConversationAdapter, ConversationConfig } from "../types.js";

export interface LiveKitConversationOptions {
	/** Use a dedicated room; this adapter attaches remote audio and owns its connection. */
	room?: Room;
	connect: () => Promise<{ url: string; token: string; options?: RoomConnectOptions }>;
	agentIdentity?: string;
	/** Application-defined RPC or data protocol, if the agent supports it. */
	updateContext?: (room: Room, text: string) => Promise<void>;
	interrupt?: (room: Room) => Promise<void>;
}

type LiveKitConnection = {
	id: number;
	config: ConversationConfig;
	connected: boolean;
	released: boolean;
	ended: Promise<void>;
	end: () => void;
	removeListeners: (() => void)[];
	audio: Map<RemoteTrack, HTMLMediaElement>;
	streams: Map<string, { streamId: string; final: boolean }>;
	microphone?: LocalTrack;
	inputTrack: MediaStreamTrack | null;
	removeMicrophoneListener: () => void;
	publishInputStream: () => void;
};

export function createLiveKitConversation(
	options: LiveKitConversationOptions
): ConversationAdapter {
	const room = options.room ?? new Room();
	let activeConnection: LiveKitConnection | undefined;
	let nextConnectionId = 0;
	let pendingDisconnect: Promise<void> | undefined;
	const agent = () =>
		[...room.remoteParticipants.values()].find((participant) =>
			options.agentIdentity ? participant.identity === options.agentIdentity : participant.isAgent
		);
	const isSelectedAgent = (identity: string) =>
		identity === (options.agentIdentity ?? agent()?.identity);
	const isCurrent = (call: LiveKitConnection) =>
		activeConnection === call && !call.released && !call.config.signal?.aborted;

	function detachAudio(call: LiveKitConnection, track: RemoteTrack) {
		const element = call.audio.get(track);
		if (!element) return;
		track.detach(element);
		element.pause();
		element.srcObject = null;
		element.remove();
		call.audio.delete(track);
	}

	function releaseConnection(call: LiveKitConnection) {
		if (call.released) return;
		call.released = true;
		call.connected = false;
		call.end();
		if (activeConnection === call) activeConnection = undefined;
		for (const remove of call.removeListeners) remove();
		call.removeListeners = [];
		call.removeMicrophoneListener();
		call.removeMicrophoneListener = () => {};
		call.microphone = undefined;
		call.inputTrack = null;
		for (const track of call.audio.keys()) detachAudio(call, track);
		call.streams.clear();
		call.config.onInputStream?.(null);
	}

	function disconnectNative() {
		if (pendingDisconnect) return pendingDisconnect;
		const closing = Promise.resolve()
			.then(() => room.disconnect())
			.finally(() => {
				if (pendingDisconnect === closing) pendingDisconnect = undefined;
			});
		pendingDisconnect = closing;
		return closing;
	}

	function connectedCall() {
		const call = activeConnection;
		if (!call || !isCurrent(call) || !call.connected)
			throw new Error("Connect the LiveKit session before using its controls.");
		return call;
	}

	return {
		textMessageOwner: "session",
		capabilities: {
			text: true,
			context: !!options.updateContext,
			mute: true,
			inputDevice: true,
			interrupt: !!options.interrupt,
			audioLevels: true,
		},
		async connect(config) {
			await pendingDisconnect;
			if (config.signal?.aborted) return;
			if (activeConnection) throw new Error("The LiveKit session is already open.");
			let end!: () => void;
			const ended = new Promise<void>((resolve) => (end = resolve));
			const call: LiveKitConnection = {
				id: ++nextConnectionId,
				config,
				connected: false,
				released: false,
				ended,
				end,
				removeListeners: [],
				audio: new Map(),
				streams: new Map(),
				inputTrack: null,
				removeMicrophoneListener: () => {},
				publishInputStream: () => {},
			};
			activeConnection = call;
			const on = <E extends keyof RoomEventCallbacks>(event: E, handler: RoomEventCallbacks[E]) => {
				const guarded = ((...args: Parameters<RoomEventCallbacks[E]>) => {
					if (isCurrent(call))
						(handler as (...args: Parameters<RoomEventCallbacks[E]>) => void)(...args);
				}) as RoomEventCallbacks[E];
				room.on(event, guarded);
				call.removeListeners.push(() => room.off(event, guarded));
			};
			const publishInputStream = () => {
				if (!isCurrent(call)) return;
				const microphone = room.localParticipant.getTrackPublication(
					Track.Source.Microphone
				)?.track;
				if (microphone !== call.microphone) {
					call.removeMicrophoneListener();
					call.microphone = microphone;
					microphone?.on(TrackEvent.Restarted, publishInputStream);
					call.removeMicrophoneListener = () =>
						microphone?.off(TrackEvent.Restarted, publishInputStream);
				}
				const track = microphone?.mediaStreamTrack ?? null;
				if (track === call.inputTrack) return;
				call.inputTrack = track;
				config.onInputStream?.(track ? new MediaStream([track]) : null);
			};
			call.publishInputStream = publishInputStream;
			const updateActivity = () => {
				const state = agent()?.attributes["lk.agent.state"];
				if (state === "listening" || state === "thinking" || state === "speaking")
					config.onActivityChange?.(state as AgentActivity);
			};
			const abort = () => {
				releaseConnection(call);
				void disconnectNative().catch(() => {});
			};
			config.signal?.addEventListener("abort", abort, { once: true });
			call.removeListeners.push(() => config.signal?.removeEventListener("abort", abort));
			try {
				on(RoomEvent.Disconnected, () => {
					releaseConnection(call);
					config.onDisconnect();
				});
				on(RoomEvent.ParticipantAttributesChanged, updateActivity);
				on(RoomEvent.LocalTrackPublished, publishInputStream);
				on(RoomEvent.LocalTrackUnpublished, publishInputStream);
				on(RoomEvent.ActiveDeviceChanged, (kind) => {
					if (kind === "audioinput") publishInputStream();
				});
				on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
					if (
						track.kind !== Track.Kind.Audio ||
						!isSelectedAgent(participant.identity) ||
						call.audio.has(track)
					)
						return;
					const element = track.attach();
					call.audio.set(track, element);
					void element.play().catch((error) => {
						if (isCurrent(call)) config.onError(error);
					});
				});
				on(RoomEvent.TrackUnsubscribed, (track) => detachAudio(call, track));
				for (const topic of ["lk.transcription", "lk.chat"]) {
					room.registerTextStreamHandler(topic, async (reader, participant) => {
						if (!isCurrent(call)) return;
						const isLocal = participant.identity === room.localParticipant.identity;
						if (!isLocal && !isSelectedAgent(participant.identity)) return;
						let text = "";
						const attributes = reader.info.attributes;
						const segment = attributes?.["lk.segment_id"] ?? reader.info.id;
						const messageId = `livekit-${call.id}-${participant.identity}-${attributes?.["lk.transcribed_track_id"] ?? "text"}-${segment}`;
						const final = attributes?.["lk.transcription_final"] !== "false";
						if (call.streams.get(messageId)?.final && !final) return;
						call.streams.set(messageId, { streamId: reader.info.id, final });
						const latest = () =>
							isCurrent(call) && call.streams.get(messageId)?.streamId === reader.info.id;
						const source = isLocal ? "user" : "ai";
						try {
							for await (const chunk of reader) {
								if (!latest()) return;
								text += chunk;
								config.onMessage({ id: messageId, source, message: text, final: false });
							}
							if (latest()) config.onMessage({ id: messageId, source, message: text, final });
						} catch (error) {
							if (isCurrent(call))
								config.onError(error instanceof Error ? error : new Error(String(error)));
						}
					});
					call.removeListeners.push(() => room.unregisterTextStreamHandler(topic));
				}
				const credentials = await Promise.race([options.connect(), ended]);
				if (!isCurrent(call)) return;
				const {
					url,
					token,
					options: connectOptions,
				} = credentials as Awaited<ReturnType<LiveKitConversationOptions["connect"]>>;
				const opening = room.connect(url, token, connectOptions);
				void opening.then(
					() => {
						if (call.released && !activeConnection) void disconnectNative().catch(() => {});
					},
					() => {}
				);
				await Promise.race([opening, ended]);
				if (!isCurrent(call)) return;
				await Promise.race([room.localParticipant.setMicrophoneEnabled(true), ended]);
				if (!isCurrent(call)) return;
				call.connected = true;
				publishInputStream();
				config.onConnect();
				updateActivity();
			} catch (error) {
				if (isCurrent(call)) {
					releaseConnection(call);
					await disconnectNative().catch(() => {});
					throw error;
				}
			}
		},
		async disconnect() {
			if (activeConnection) releaseConnection(activeConnection);
			await disconnectNative();
		},
		async sendMessage(text) {
			connectedCall();
			await room.localParticipant.sendText(text, { topic: "lk.chat" });
		},
		async sendContextualUpdate(text) {
			connectedCall();
			if (!options.updateContext) throw new Error("Configure updateContext for this agent.");
			await options.updateContext(room, text);
		},
		async setMuted(muted) {
			const call = connectedCall();
			await room.localParticipant.setMicrophoneEnabled(!muted);
			call.publishInputStream();
		},
		async setInputDevice(deviceId) {
			const call = connectedCall();
			await room.switchActiveDevice("audioinput", deviceId);
			call.publishInputStream();
		},
		async interrupt() {
			connectedCall();
			if (!options.interrupt) throw new Error("Configure interrupt for this agent.");
			await options.interrupt(room);
		},
		getInputVolume: () => (activeConnection?.connected ? room.localParticipant.audioLevel : 0),
		getOutputVolume: () => (activeConnection?.connected ? (agent()?.audioLevel ?? 0) : 0),
	};
}
