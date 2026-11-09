import {
	Conversation,
	Scribe,
	CommitStrategy,
	RealtimeEvents,
	type PartialOptions,
	type AudioOptions,
	type MicrophoneOptions,
	type RealtimeConnection,
} from "@elevenlabs/client";
import type {
	ConversationAdapter,
	ConversationConfig,
	TranscriptionAdapter,
	TranscriptionAdapterCallbacks,
} from "../types.js";

/** Resolve auth at connection time so signed URLs/tokens can be refreshed. */
export function createElevenLabsConversation(
	options: () => PartialOptions | Promise<PartialOptions>
): ConversationAdapter {
	let conversation: Conversation | null = null;
	let generation = 0;
	return {
		capabilities: {
			text: true,
			context: true,
			mute: true,
			inputDevice: true,
			audioLevels: true,
			interrupt: false,
		},
		async connect(config: ConversationConfig) {
			const id = ++generation;
			const settings = await options();
			if (id !== generation || config.signal?.aborted) return;
			const active = () => id === generation && !config.signal?.aborted;
			const opened = await Conversation.startSession({
				...settings,
				onConnect: (data) => {
					if (active()) {
						settings.onConnect?.(data);
					}
				},
				onDisconnect: (data) => {
					if (active()) {
						settings.onDisconnect?.(data);
						config.onDisconnect();
					}
				},
				onStatusChange: (data) => {
					if (active()) {
						settings.onStatusChange?.(data);
						if (data.status !== "connected") config.onStatusChange(data.status);
					}
				},
				onModeChange: (data) => {
					if (active()) {
						settings.onModeChange?.(data);
						config.onModeChange?.(data.mode);
					}
				},
				onMessage: (data) => {
					if (active()) {
						settings.onMessage?.(data);
						config.onMessage({
							id: `elevenlabs-${data.source}-${data.event_id}`,
							source: data.source,
							message: data.message,
							final: true,
						});
					}
				},
				onError: (message, context) => {
					if (active()) {
						settings.onError?.(message, context);
						config.onError(new Error(message));
					}
				},
			});
			if (!active()) {
				await opened.endSession();
				return;
			}
			conversation = opened;
			config.onConnect();
		},
		async disconnect() {
			++generation;
			const old = conversation;
			conversation = null;
			await old?.endSession();
		},
		sendMessage(text) {
			if (!conversation) throw new Error("Conversation is not connected.");
			conversation.sendUserMessage(text);
		},
		sendContextualUpdate(text) {
			conversation?.sendContextualUpdate(text);
		},
		setMuted(muted) {
			conversation?.setMicMuted(muted);
		},
		async setInputDevice(inputDeviceId) {
			if (conversation && "changeInputDevice" in conversation)
				await conversation.changeInputDevice({ inputDeviceId });
		},
		getInputVolume: () => conversation?.getInputVolume() ?? 0,
		getOutputVolume: () => conversation?.getOutputVolume() ?? 0,
	};
}

export type ElevenLabsScribeOptions =
	| Omit<AudioOptions, "token">
	| Omit<MicrophoneOptions, "token">;
export function createElevenLabsTranscription(options: {
	getToken: (signal?: AbortSignal) => Promise<string>;
	/** All native Scribe options, including VAD and manual PCM configuration. */
	scribe?: ElevenLabsScribeOptions;
	finalizeTimeoutMs?: number;
	startupTimeoutMs?: number;
}): TranscriptionAdapter {
	let connection: RealtimeConnection | null = null;
	let generation = 0;
	let settleStart: ((error?: Error) => void) | undefined;
	let settleStop: ((error?: Error) => void) | undefined;
	let callbacks: TranscriptionAdapterCallbacks = {};
	let hasPartial = false;
	let tokenAbort: AbortController | undefined;
	return {
		async start(next) {
			const id = ++generation;
			callbacks = next;
			hasPartial = false;
			tokenAbort?.abort();
			const controller = (tokenAbort = new AbortController());
			const token = await Promise.race([
				options.getToken(controller.signal),
				new Promise<undefined>((resolve) =>
					controller.signal.addEventListener("abort", () => resolve(undefined), { once: true })
				),
			]);
			if (id !== generation) return;
			if (!token) throw new Error("Scribe token is empty.");
			const settings = options.scribe ?? { modelId: "scribe_v2_realtime", microphone: {} };
			const current = Scribe.connect({ commitStrategy: CommitStrategy.VAD, ...settings, token });
			connection = current;
			try {
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(
						() => settleStart?.(new Error("Scribe startup timed out.")),
						options.startupTimeoutMs ?? 15000
					);
					settleStart = (error) => {
						clearTimeout(timeout);
						settleStart = undefined;
						if (error) reject(error);
						else resolve();
					};
					current.on(RealtimeEvents.SESSION_STARTED, () => {
						if (id === generation) {
							callbacks.onConnect?.();
							settleStart?.();
						}
					});
					current.on(RealtimeEvents.PARTIAL_TRANSCRIPT, ({ text }) => {
						if (id === generation) {
							hasPartial = !!text;
							callbacks.onPartialTranscript?.(text);
						}
					});
					current.on(RealtimeEvents.COMMITTED_TRANSCRIPT, ({ text }) => {
						if (id === generation) {
							hasPartial = false;
							callbacks.onCommittedTranscript?.(text);
							settleStop?.();
						}
					});
					const fail = (data: { error: string }) => {
						if (id !== generation) return;
						const error = new Error(data.error, { cause: data });
						settleStart?.(error);
						settleStop?.(error);
						callbacks.onError?.(error);
					};
					current.on(RealtimeEvents.ERROR, fail);
					current.on(RealtimeEvents.CLOSE, () => {
						if (id === generation) {
							callbacks.onDisconnect?.();
							settleStart?.(new Error("Scribe closed before becoming ready."));
							settleStop?.(new Error("Scribe closed before finalizing the transcript."));
						}
					});
				});
			} catch (error) {
				if (id === generation) {
					++generation;
					connection = null;
					current.close();
				}
				throw error;
			}
		},
		async stop() {
			const current = connection;
			if (!current) {
				tokenAbort?.abort();
				++generation;
				return;
			}
			try {
				if (hasPartial)
					await new Promise<void>((resolve, reject) => {
						const timeout = setTimeout(
							() => settleStop?.(new Error("Timed out waiting for the final transcript.")),
							options.finalizeTimeoutMs ?? 2000
						);
						settleStop = (error) => {
							clearTimeout(timeout);
							settleStop = undefined;
							if (error) reject(error);
							else resolve();
						};
						try {
							current.commit();
						} catch (error) {
							settleStop(error instanceof Error ? error : new Error(String(error)));
						}
					});
			} finally {
				++generation;
				settleStart?.();
				connection = null;
				current.close();
			}
		},
		cancel() {
			tokenAbort?.abort();
			++generation;
			settleStart?.();
			settleStop?.();
			connection?.close();
			connection = null;
		},
		commit() {
			connection?.commit();
		},
		sendAudio(audio) {
			if (!connection) throw new Error("Transcription is not connected.");
			let binary = "";
			for (const byte of audio) binary += String.fromCharCode(byte);
			connection.send({ audioBase64: btoa(binary) });
		},
	};
}
