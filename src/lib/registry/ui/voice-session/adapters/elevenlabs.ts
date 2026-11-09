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
import {
	UnsupportedCapabilityError,
	type ConversationAdapter,
	type ConversationConfig,
	type TranscriptionAdapter,
	type TranscriptionAdapterCallbacks,
} from "../types.js";

type Completion = ReturnType<typeof createCompletion>;
function createCompletion() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((complete, fail) => {
		resolve = complete;
		reject = fail;
	});
	return { promise, resolve, reject };
}
const asError = (cause: unknown) => (cause instanceof Error ? cause : new Error(String(cause)));

type ConversationAttempt = {
	conversation?: Conversation;
	started: Completion;
	cancelled: Completion;
	closed: boolean;
	closing?: Promise<void>;
	removeAbortListener?: () => void;
};

/** Resolve auth at connection time so signed URLs/tokens can be refreshed. */
export function createElevenLabsConversation(
	options: () => PartialOptions | Promise<PartialOptions>
): ConversationAdapter {
	let activeAttempt: ConversationAttempt | undefined;
	let closing: Promise<void> | undefined;
	const isActive = (attempt: ConversationAttempt) => activeAttempt === attempt && !attempt.closed;
	function closeAttempt(attempt: ConversationAttempt): Promise<void> {
		if (attempt.closing) return attempt.closing;
		attempt.closed = true;
		if (activeAttempt === attempt) activeAttempt = undefined;
		attempt.removeAbortListener?.();
		attempt.cancelled.resolve();
		attempt.started.resolve();
		const conversation = attempt.conversation;
		attempt.conversation = undefined;
		const ending = Promise.resolve(closing)
			.then(() => conversation?.endSession())
			.finally(() => {
				if (closing === ending) closing = undefined;
			});
		attempt.closing = closing = ending;
		return ending;
	}
	function requireConversation() {
		const conversation = activeAttempt?.conversation;
		if (!conversation) throw new Error("Conversation is not connected.");
		return conversation;
	}
	function requireVoiceConversation(capability: "mute" | "inputDevice") {
		const conversation = requireConversation();
		if (conversation.type !== "voice") throw new UnsupportedCapabilityError(capability);
		return conversation;
	}
	const adapter: ConversationAdapter = {
		textMessageOwner: "session",
		get capabilities() {
			const hasMicrophone = activeAttempt?.conversation?.type === "voice";
			return {
				text: true,
				context: true,
				mute: hasMicrophone,
				inputDevice: hasMicrophone,
				audioLevels: hasMicrophone,
				interrupt: false,
			};
		},
		connect(config: ConversationConfig) {
			if (config.signal?.aborted) return Promise.resolve();
			if (activeAttempt) return activeAttempt.started.promise;
			const previousClosing = closing;
			const attempt: ConversationAttempt = {
				started: createCompletion(),
				cancelled: createCompletion(),
				closed: false,
			};
			activeAttempt = attempt;
			const onAbort = () => {
				void closeAttempt(attempt).catch((error) => config.onError(asError(error)));
			};
			config.signal?.addEventListener("abort", onAbort, { once: true });
			attempt.removeAbortListener = () => config.signal?.removeEventListener("abort", onAbort);
			void (async () => {
				if (previousClosing) await previousClosing;
				if (!isActive(attempt)) return;
				const settings = await Promise.race([
					options(),
					attempt.cancelled.promise.then(() => undefined),
				]);
				if (!settings || !isActive(attempt)) return;
				const conversation = await Conversation.startSession({
					...settings,
					onConnect: (data) => {
						if (isActive(attempt)) settings.onConnect?.(data);
					},
					onDisconnect: (data) => {
						if (!isActive(attempt)) return;
						attempt.conversation = undefined;
						void closeAttempt(attempt);
						settings.onDisconnect?.(data);
						config.onDisconnect();
					},
					onStatusChange: (data) => {
						if (!isActive(attempt)) return;
						settings.onStatusChange?.(data);
						if (data.status !== "connected") config.onStatusChange(data.status);
					},
					onModeChange: (data) => {
						if (!isActive(attempt)) return;
						settings.onModeChange?.(data);
						config.onModeChange?.(data.mode);
					},
					onMessage: (data) => {
						if (!isActive(attempt)) return;
						settings.onMessage?.(data);
						config.onMessage({
							id: `elevenlabs-${data.source}-${data.event_id}`,
							source: data.source,
							message: data.message,
							final: true,
						});
					},
					onError: (message, context) => {
						if (!isActive(attempt)) return;
						settings.onError?.(message, context);
						config.onError(new Error(message, { cause: context }));
					},
				});
				if (!isActive(attempt)) {
					await conversation.endSession();
					return;
				}
				attempt.conversation = conversation;
				attempt.started.resolve();
				config.onConnect();
			})().catch((error) => {
				if (!isActive(attempt)) return;
				attempt.started.reject(asError(error));
				void closeAttempt(attempt).catch(() => {});
			});
			return attempt.started.promise;
		},
		disconnect() {
			return activeAttempt ? closeAttempt(activeAttempt) : (closing ?? Promise.resolve());
		},
		sendMessage: (text) => requireConversation().sendUserMessage(text),
		sendContextualUpdate: (text) => requireConversation().sendContextualUpdate(text),
		setMuted: (muted) => requireVoiceConversation("mute").setMicMuted(muted),
		async setInputDevice(inputDeviceId) {
			await requireVoiceConversation("inputDevice").changeInputDevice({ inputDeviceId });
		},
		getInputVolume: () => activeAttempt?.conversation?.getInputVolume() ?? 0,
		getOutputVolume: () => activeAttempt?.conversation?.getOutputVolume() ?? 0,
	};
	return adapter;
}

export type ElevenLabsScribeOptions =
	| Omit<AudioOptions, "token">
	| Omit<MicrophoneOptions, "token">;
type ScribeAttempt = {
	callbacks: TranscriptionAdapterCallbacks;
	connection?: RealtimeConnection;
	started: Completion;
	cancelled: Completion;
	abort: AbortController;
	ready: boolean;
	closed: boolean;
	microphoneStarted: boolean;
	audioSubmitted: boolean;
	finalTranscript?: Completion;
	stopping?: Promise<void>;
	startupTimer?: ReturnType<typeof setTimeout>;
	finalizeTimer?: ReturnType<typeof setTimeout>;
};

export function createElevenLabsTranscription(options: {
	getToken: (signal?: AbortSignal) => Promise<string>;
	/** All native Scribe options, including VAD and manual PCM configuration. */
	scribe?: ElevenLabsScribeOptions;
	finalizeTimeoutMs?: number;
	startupTimeoutMs?: number;
}): TranscriptionAdapter {
	let activeAttempt: ScribeAttempt | undefined;
	let pendingRestart: Completion | undefined;
	const isActive = (attempt: ScribeAttempt) => activeAttempt === attempt && !attempt.closed;
	function closeAttempt(attempt: ScribeAttempt) {
		if (attempt.closed) return;
		attempt.closed = true;
		if (activeAttempt === attempt) activeAttempt = undefined;
		clearTimeout(attempt.startupTimer);
		clearTimeout(attempt.finalizeTimer);
		attempt.cancelled.resolve();
		attempt.abort.abort();
		attempt.started.resolve();
		attempt.finalTranscript?.resolve();
		const connection = attempt.connection;
		attempt.connection = undefined;
		connection?.close();
	}
	function failAttempt(attempt: ScribeAttempt, error: Error) {
		if (!isActive(attempt)) return;
		attempt.started.reject(error);
		attempt.finalTranscript?.reject(error);
		closeAttempt(attempt);
		attempt.callbacks.onError?.(error);
	}
	function requireConnection() {
		const attempt = activeAttempt;
		if (!attempt?.ready || !attempt.connection) throw new Error("Transcription is not connected.");
		return { attempt, connection: attempt.connection };
	}
	const adapter: TranscriptionAdapter = {
		start(callbacks) {
			if (activeAttempt?.stopping) {
				if (pendingRestart) return pendingRestart.promise;
				const restart = (pendingRestart = createCompletion());
				void activeAttempt.stopping
					.catch(() => {})
					.then(async () => {
						if (pendingRestart !== restart) return;
						pendingRestart = undefined;
						try {
							await adapter.start(callbacks);
							restart.resolve();
						} catch (error) {
							restart.reject(asError(error));
						}
					});
				return restart.promise;
			}
			if (activeAttempt) return activeAttempt.started.promise;
			const attempt: ScribeAttempt = {
				callbacks,
				started: createCompletion(),
				cancelled: createCompletion(),
				abort: new AbortController(),
				ready: false,
				closed: false,
				microphoneStarted: false,
				audioSubmitted: false,
			};
			activeAttempt = attempt;
			attempt.startupTimer = setTimeout(
				() => failAttempt(attempt, new Error("Scribe startup timed out.")),
				options.startupTimeoutMs ?? 15000
			);
			void (async () => {
				const token = await Promise.race([
					options.getToken(attempt.abort.signal),
					attempt.cancelled.promise.then(() => undefined),
				]);
				if (!isActive(attempt)) return;
				if (!token) throw new Error("Scribe token is empty.");
				const settings = options.scribe ?? { modelId: "scribe_v2_realtime", microphone: {} };
				const connection = Scribe.connect({
					commitStrategy: CommitStrategy.VAD,
					...settings,
					token,
				});
				attempt.connection = connection;
				connection.on(RealtimeEvents.SESSION_STARTED, () => {
					if (!isActive(attempt)) return;
					clearTimeout(attempt.startupTimer);
					attempt.ready = true;
					attempt.started.resolve();
					attempt.callbacks.onConnect?.();
				});
				connection.on(RealtimeEvents.AUDIO_STARTED, () => {
					if (isActive(attempt)) attempt.microphoneStarted = true;
				});
				connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, ({ text }) => {
					if (!isActive(attempt)) return;
					attempt.audioSubmitted ||= !!text;
					attempt.callbacks.onPartialTranscript?.(text);
				});
				connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, ({ text }) => {
					if (!isActive(attempt)) return;
					attempt.audioSubmitted = false;
					attempt.callbacks.onCommittedTranscript?.(text);
					attempt.finalTranscript?.resolve();
				});
				connection.on(RealtimeEvents.ERROR, (data) =>
					failAttempt(attempt, new Error(data.error, { cause: data }))
				);
				connection.on(RealtimeEvents.CLOSE, () => {
					if (!isActive(attempt)) return;
					attempt.started.reject(new Error("Scribe closed before becoming ready."));
					attempt.finalTranscript?.reject(
						new Error("Scribe closed before finalizing the transcript.")
					);
					attempt.connection = undefined;
					closeAttempt(attempt);
					attempt.callbacks.onDisconnect?.();
				});
			})().catch((error) => failAttempt(attempt, asError(error)));
			return attempt.started.promise;
		},
		stop() {
			const attempt = activeAttempt;
			if (!attempt) return Promise.resolve();
			if (attempt.stopping) return attempt.stopping;
			if (!attempt.ready || (!attempt.microphoneStarted && !attempt.audioSubmitted)) {
				closeAttempt(attempt);
				return Promise.resolve();
			}
			const finalTranscript = (attempt.finalTranscript = createCompletion());
			attempt.finalizeTimer = setTimeout(
				() => finalTranscript.reject(new Error("Timed out waiting for the final transcript.")),
				options.finalizeTimeoutMs ?? 2000
			);
			attempt.stopping = finalTranscript.promise.finally(() => closeAttempt(attempt));
			try {
				attempt.connection!.commit();
			} catch (error) {
				finalTranscript.reject(asError(error));
			}
			return attempt.stopping;
		},
		cancel() {
			pendingRestart?.resolve();
			pendingRestart = undefined;
			if (activeAttempt) closeAttempt(activeAttempt);
		},
		commit() {
			requireConnection().connection.commit();
		},
		sendAudio(audio) {
			const { attempt, connection } = requireConnection();
			let binary = "";
			for (const byte of audio) binary += String.fromCharCode(byte);
			connection.send({ audioBase64: btoa(binary) });
			attempt.audioSubmitted = true;
		},
	};
	return adapter;
}
