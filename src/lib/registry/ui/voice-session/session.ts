import {
	UnsupportedCapabilityError,
	type AgentActivity,
	type AgentConnectionState,
	type ConversationAdapter,
	type ConversationCapabilities,
	type ConversationMessage,
} from "./types.js";

export interface ConversationSnapshot {
	readonly status: AgentConnectionState;
	readonly activity: AgentActivity;
	readonly messages: readonly ConversationMessage[];
	readonly muted: boolean;
	readonly inputDeviceId?: string;
	readonly inputLevel: number;
	readonly outputLevel: number;
	readonly inputStream: MediaStream | null;
	readonly error: Error | null;
}
interface ConnectionAttempt {
	abort: AbortController;
	opening: Promise<void>;
}
const disconnected = {
	status: "disconnected",
	activity: "idle",
	muted: false,
	inputDeviceId: undefined,
	inputLevel: 0,
	outputLevel: 0,
	inputStream: null,
} as const;
const level = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));
const cancelled = () => new DOMException("The connection has ended.", "AbortError");

/** Share across controls. The creator owns disconnect/dispose. */
export class ConversationSession {
	#snapshot: ConversationSnapshot = { ...disconnected, messages: [], error: null };
	#listeners = new Set<(snapshot: ConversationSnapshot) => void>();
	#messageListeners = new Set<(message: ConversationMessage) => void>();
	#connection: ConnectionAttempt | null = null;
	#closing: Promise<void> | null = null;
	#localId = 0;
	#disposed = false;
	#disconnectVersion = 0;
	constructor(readonly adapter?: ConversationAdapter) {}
	get snapshot() {
		return this.#snapshot;
	}
	get capabilities(): ConversationCapabilities {
		return this.adapter?.capabilities ?? {};
	}
	subscribe(listener: (snapshot: ConversationSnapshot) => void): () => void {
		this.#listeners.add(listener);
		listener(this.#snapshot);
		return () => this.#listeners.delete(listener);
	}
	/** Observe adapter events; use subscribe() for the complete transcript, including local input. */
	subscribeMessages(listener: (message: ConversationMessage) => void): () => void {
		this.#messageListeners.add(listener);
		return () => this.#messageListeners.delete(listener);
	}
	#update(patch: Partial<ConversationSnapshot>) {
		this.#snapshot = { ...this.#snapshot, ...patch };
		for (const listener of this.#listeners) listener(this.#snapshot);
	}
	#message(message: ConversationMessage) {
		const messages = this.snapshot.messages;
		const index = message.id ? messages.findIndex((m) => m.id === message.id) : -1;
		const next = { ...message, id: message.id ?? `sv11-message-${++this.#localId}` };
		this.#update({
			messages: index >= 0 ? messages.map((m, i) => (i === index ? next : m)) : [...messages, next],
		});
	}
	#current(attempt: ConnectionAttempt) {
		return this.#connection === attempt && !attempt.abort.signal.aborted;
	}
	async #untilEnded<T>(attempt: ConnectionAttempt, operation: () => T | Promise<T>): Promise<T> {
		if (!this.#current(attempt)) throw cancelled();
		const signal = attempt.abort.signal;
		let onAbort!: () => void;
		const ended = new Promise<never>((_, reject) => {
			onAbort = () => reject(cancelled());
			signal.addEventListener("abort", onAbort, { once: true });
		});
		try {
			const value = await Promise.race([operation(), ended]);
			if (!this.#current(attempt)) throw cancelled();
			return value;
		} finally {
			signal.removeEventListener("abort", onAbort);
		}
	}
	connect(): Promise<void> {
		if (this.#disposed) return Promise.reject(new Error("Session has been disposed."));
		if (this.#closing) {
			const disconnectVersion = this.#disconnectVersion;
			return this.#closing.then(() => {
				if (disconnectVersion !== this.#disconnectVersion) throw cancelled();
				return this.connect();
			});
		}
		if (this.#connection) return this.#connection.opening;
		if (!this.adapter) {
			const error = new Error("Provide a conversation adapter or session to start a call.");
			this.#update({ error });
			return Promise.reject(error);
		}
		const adapter = this.adapter;
		const attempt: ConnectionAttempt = {
			abort: new AbortController(),
			opening: Promise.resolve(),
		};
		this.#connection = attempt;
		const current = () => this.#current(attempt);
		const connected = () => {
			if (current() && this.snapshot.status === "connecting")
				this.#update({ status: "connected", activity: "listening" });
		};
		attempt.opening = Promise.resolve()
			.then(() =>
				this.#untilEnded(attempt, () =>
					adapter.connect({
						signal: attempt.abort.signal,
						onConnect: connected,
						onDisconnect: () => {
							if (current()) void this.#end(attempt);
						},
						onStatusChange: (status) => {
							if (!current()) return;
							if (status === "disconnected" || status === "disconnecting") void this.#end(attempt);
							else if (status === "connected") connected();
						},
						onModeChange: (mode) => {
							if (current())
								this.#update({ activity: mode === "speaking" ? "speaking" : "listening" });
						},
						onActivityChange: (activity) => {
							if (current()) this.#update({ activity });
						},
						onMessage: (message) => {
							if (!current()) return;
							this.#message(message);
							for (const listener of this.#messageListeners) listener(message);
						},
						onAudioLevels: ({ input, output }) => {
							if (current()) this.#update({ inputLevel: level(input), outputLevel: level(output) });
						},
						onInputStream: (inputStream) => {
							if (current()) this.#update({ inputStream });
						},
						onError: (error) => {
							if (current()) this.#update({ error });
						},
					})
				)
			)
			.then(connected)
			.catch(async (error: unknown) => {
				if (current()) await this.#end(attempt, asError(error));
				throw error;
			});
		this.#update({ status: "connecting", error: null });
		return attempt.opening;
	}
	#end(attempt: ConnectionAttempt, error?: Error): Promise<void> {
		if (!this.#current(attempt)) return this.#closing ?? Promise.resolve();
		this.#connection = null;
		attempt.abort.abort();
		const closing = Promise.resolve()
			.then(() => this.adapter?.disconnect())
			.catch((failure) => {
				if (!error) this.#update({ error: asError(failure) });
			})
			.finally(() => {
				this.#closing = null;
				this.#update(disconnected);
			});
		this.#closing = closing;
		this.#update({ ...disconnected, status: "disconnecting", ...(error ? { error } : {}) });
		return closing;
	}
	disconnect(): Promise<void> {
		++this.#disconnectVersion;
		return this.#connection ? this.#end(this.#connection) : (this.#closing ?? Promise.resolve());
	}
	async #run(
		capability: keyof ConversationCapabilities,
		operation: () => void | Promise<void>,
		commit?: () => void
	) {
		const attempt = this.#connection;
		try {
			if (!attempt || this.snapshot.status !== "connected")
				throw new Error("Connect before changing the session.");
			if (this.capabilities[capability] === false) throw new UnsupportedCapabilityError(capability);
			await this.#untilEnded(attempt, operation);
			if (!this.#current(attempt)) throw cancelled();
			commit?.();
		} catch (error) {
			if (!attempt || this.#current(attempt)) this.#update({ error: asError(error) });
			throw error;
		}
	}
	/** Resolves when the SDK accepts submission; cancellation cannot undo already-sent input. */
	async sendMessage(text: string) {
		if (!text.trim()) return;
		await this.connect();
		await this.#run(
			"text",
			() => this.adapter!.sendMessage(text),
			() => {
				if (this.adapter!.textMessageOwner !== "adapter")
					this.#message({
						id: `sv11-local-${++this.#localId}`,
						source: "user",
						message: text,
						final: true,
					});
			}
		);
	}
	async sendContextualUpdate(text: string) {
		await this.#run("context", () => this.adapter!.sendContextualUpdate(text));
	}
	async setMuted(muted: boolean) {
		await this.#run(
			"mute",
			() => this.adapter!.setMuted(muted),
			() => this.#update({ muted })
		);
	}
	async setInputDevice(deviceId: string) {
		await this.#run(
			"inputDevice",
			() => {
				if (!this.adapter?.setInputDevice) throw new UnsupportedCapabilityError("inputDevice");
				return this.adapter.setInputDevice(deviceId);
			},
			() => this.#update({ inputDeviceId: deviceId })
		);
	}
	async interrupt() {
		await this.#run("interrupt", () => {
			if (!this.adapter?.interrupt) throw new UnsupportedCapabilityError("interrupt");
			return this.adapter.interrupt();
		});
	}
	getInputVolume = () =>
		this.snapshot.status !== "connected" || this.snapshot.muted
			? 0
			: level(this.adapter?.getInputVolume?.() ?? this.snapshot.inputLevel);
	getOutputVolume = () =>
		this.snapshot.status !== "connected"
			? 0
			: level(this.adapter?.getOutputVolume?.() ?? this.snapshot.outputLevel);
	clearMessages() {
		this.#update({ messages: [] });
	}
	async dispose() {
		this.#disposed = true;
		await this.disconnect();
		this.#listeners.clear();
		this.#messageListeners.clear();
	}
}
export const createConversationSession = (adapter: ConversationAdapter) =>
	new ConversationSession(adapter);
