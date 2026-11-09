import {
	BotOutputType,
	RTVIEvent,
	type PipecatClient,
	type RTVIEventHandler,
	type TransportConnectionParams,
} from "@pipecat-ai/client-js";
import type { ConversationAdapter, ConversationConfig } from "../types.js";

export interface PipecatConversationOptions {
	/** Application-defined context protocol; ordinary chat is never used for draft updates. */
	updateContext?: (client: PipecatClient, text: string) => void | Promise<void>;
}

type PipecatConnection = {
	id: number;
	config: ConversationConfig;
	connected: boolean;
	released: boolean;
	ended: Promise<void>;
	end: () => void;
	removeListeners: (() => void)[];
	audio: Map<MediaStreamTrack, HTMLMediaElement>;
	typedMessages: Map<string, string>;
	inputTrack?: MediaStreamTrack;
	inputLevel: number;
	outputLevel: number;
	utterance: number;
};

/** Pass a dedicated SDK client configured with your chosen transport. */
export function createPipecatConversation(
	client: PipecatClient,
	connection: () => TransportConnectionParams | Promise<TransportConnectionParams>,
	options: PipecatConversationOptions = {}
): ConversationAdapter {
	let activeConnection: PipecatConnection | undefined;
	let nextConnectionId = 0;
	let pendingDisconnect: Promise<void> | undefined;
	const isCurrent = (call: PipecatConnection) =>
		activeConnection === call && !call.released && !call.config.signal?.aborted;

	function releaseConnection(call: PipecatConnection) {
		if (call.released) return;
		call.released = true;
		call.connected = false;
		call.end();
		if (activeConnection === call) activeConnection = undefined;
		for (const remove of call.removeListeners) remove();
		call.removeListeners = [];
		for (const element of call.audio.values()) {
			element.pause();
			element.srcObject = null;
		}
		call.audio.clear();
		call.typedMessages.clear();
		call.inputTrack = undefined;
		call.inputLevel = call.outputLevel = 0;
		call.config.onInputStream?.(null);
	}

	function disconnectNative() {
		if (pendingDisconnect) return pendingDisconnect;
		const closing = Promise.resolve()
			.then(() => client.disconnect())
			.finally(() => {
				if (pendingDisconnect === closing) pendingDisconnect = undefined;
			});
		pendingDisconnect = closing;
		return closing;
	}

	function connectedCall() {
		const call = activeConnection;
		if (!call || !isCurrent(call) || !call.connected)
			throw new Error("Connect the Pipecat session before using its controls.");
		return call;
	}

	function typedMessage(call: PipecatConnection, messageId: string, text: string) {
		if (!isCurrent(call) || call.typedMessages.get(messageId) === text) return;
		call.typedMessages.set(messageId, text);
		call.config.onMessage({
			id: `pipecat-${call.id}-user-${messageId}`,
			source: "user",
			message: text,
			final: true,
		});
	}

	return {
		textMessageOwner: "adapter",
		capabilities: {
			text: true,
			context: !!options.updateContext,
			mute: true,
			inputDevice: true,
			audioLevels: true,
			interrupt: false,
		},
		async connect(config) {
			await pendingDisconnect;
			if (config.signal?.aborted) return;
			if (activeConnection) throw new Error("The Pipecat session is already open.");
			let end!: () => void;
			const ended = new Promise<void>((resolve) => (end = resolve));
			const call: PipecatConnection = {
				id: ++nextConnectionId,
				config,
				connected: false,
				released: false,
				ended,
				end,
				removeListeners: [],
				audio: new Map(),
				typedMessages: new Map(),
				inputLevel: 0,
				outputLevel: 0,
				utterance: 0,
			};
			activeConnection = call;
			const on = <E extends RTVIEvent>(event: E, handler: RTVIEventHandler<E>) => {
				const guarded = ((...args: Parameters<RTVIEventHandler<E>>) => {
					if (isCurrent(call))
						(handler as (...args: Parameters<RTVIEventHandler<E>>) => void)(...args);
				}) as RTVIEventHandler<E>;
				client.on(event, guarded);
				call.removeListeners.push(() => client.off(event, guarded));
			};
			const abort = () => {
				releaseConnection(call);
				void disconnectNative().catch(() => {});
			};
			config.signal?.addEventListener("abort", abort, { once: true });
			call.removeListeners.push(() => config.signal?.removeEventListener("abort", abort));
			on(RTVIEvent.Disconnected, () => {
				releaseConnection(call);
				config.onDisconnect();
			});
			on(RTVIEvent.BotStartedSpeaking, () => config.onActivityChange?.("speaking"));
			on(RTVIEvent.BotStoppedSpeaking, () => config.onActivityChange?.("listening"));
			on(RTVIEvent.BotLlmStarted, () => config.onActivityChange?.("thinking"));
			on(RTVIEvent.UserStartedSpeaking, () => config.onActivityChange?.("listening"));
			on(RTVIEvent.LocalAudioLevel, (value) => {
				call.inputLevel = value;
				config.onAudioLevels?.({ input: value, output: call.outputLevel });
			});
			on(RTVIEvent.RemoteAudioLevel, (value) => {
				call.outputLevel = value;
				config.onAudioLevels?.({ input: call.inputLevel, output: value });
			});
			on(RTVIEvent.UserInput, (data) => {
				if (data.input_type === "chat" && data.msg_id) {
					typedMessage(call, data.msg_id, data.text);
					return;
				}
				config.onMessage({
					id: `pipecat-${call.id}-user-${data.msg_id ?? call.utterance}`,
					source: "user",
					message: data.text,
					final: data.final,
				});
				if (data.final) ++call.utterance;
			});
			on(RTVIEvent.BotOutput, (data) => {
				if (
					data.output_type &&
					data.output_type !== BotOutputType.SENTENCE &&
					data.output_type !== BotOutputType.BACKCHANNEL
				)
					return;
				config.onMessage({
					id:
						data.segment_id === undefined ? undefined : `pipecat-${call.id}-bot-${data.segment_id}`,
					source: "ai",
					message: data.text,
					final: true,
				});
			});
			on(RTVIEvent.Error, (data) =>
				config.onError(
					new Error(
						String(
							data.data && typeof data.data === "object" && "error" in data.data
								? data.data.error
								: "Pipecat connection failed."
						)
					)
				)
			);
			on(RTVIEvent.TrackStarted, (track, participant) => {
				if (track.kind !== "audio") return;
				if (participant?.local) {
					call.inputTrack = track;
					config.onInputStream?.(new MediaStream([track]));
					return;
				}
				if (call.audio.has(track)) return;
				const element = new Audio();
				element.srcObject = new MediaStream([track]);
				call.audio.set(track, element);
				void element.play().catch((error) => {
					if (isCurrent(call)) config.onError(error);
				});
			});
			on(RTVIEvent.TrackStopped, (track) => {
				if (track === call.inputTrack) {
					call.inputTrack = undefined;
					config.onInputStream?.(null);
				}
				const element = call.audio.get(track);
				if (element) {
					element.pause();
					element.srcObject = null;
					call.audio.delete(track);
				}
			});
			try {
				const params = await Promise.race([Promise.resolve().then(connection), ended]);
				if (!isCurrent(call)) return;
				const opening = client.connect(params as TransportConnectionParams);
				void opening.then(
					() => {
						if (call.released && !activeConnection) void disconnectNative().catch(() => {});
					},
					() => {}
				);
				await Promise.race([opening, ended]);
				if (!isCurrent(call)) return;
				call.connected = true;
				config.onConnect();
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
			const call = connectedCall();
			const messageId = await client.sendText(text);
			typedMessage(call, messageId, text);
		},
		async sendContextualUpdate(text) {
			connectedCall();
			if (!options.updateContext) throw new Error("Configure updateContext for this Pipecat bot.");
			await options.updateContext(client, text);
		},
		setMuted(muted) {
			connectedCall();
			client.enableMic(!muted);
		},
		setInputDevice(deviceId) {
			connectedCall();
			client.updateMic(deviceId);
		},
		getInputVolume: () => activeConnection?.inputLevel ?? 0,
		getOutputVolume: () => activeConnection?.outputLevel ?? 0,
	};
}
