import {
	UnsupportedCapabilityError,
	type AgentActivity,
	type AgentConnectionState,
	type ConversationAdapter,
	type ConversationCapabilities,
	type ConversationMessage,
} from "./types.js";

export interface ConversationSnapshot {
	status: AgentConnectionState;
	activity: AgentActivity;
	messages: ConversationMessage[];
	muted: boolean;
	inputDeviceId?: string;
	inputLevel: number;
	outputLevel: number;
	inputStream: MediaStream | null;
	error: Error | null;
}
const initial = (): ConversationSnapshot => ({
	status: "disconnected",
	activity: "idle",
	messages: [],
	muted: false,
	inputLevel: 0,
	outputLevel: 0,
	inputStream: null,
	error: null,
});
const level = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/** Share across controls. The creator owns disconnect/dispose. */
export class ConversationSession {
	#snapshot = initial();
	#listeners = new Set<(snapshot: ConversationSnapshot) => void>();
	#attempt = 0;
	#abort: AbortController | null = null;
	#pending: Promise<void> | null = null;
	#closing: Promise<void> | null = null;
	#localId = 0;
	#disposed = false;
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
	#update(patch: Partial<ConversationSnapshot>) {
		this.#snapshot = { ...this.#snapshot, ...patch };
		for (const listener of this.#listeners) listener(this.#snapshot);
	}
	#message(message: ConversationMessage) {
		const messages = this.snapshot.messages;
		let index = message.id ? messages.findIndex((m) => m.id === message.id) : -1;
		if (index < 0 && message.source === "user")
			index = messages.findIndex(
				(m) => m.id?.startsWith("sv11-local-") && m.message === message.message
			);
		const next = { ...message, id: message.id ?? `sv11-message-${++this.#localId}` };
		this.#update({
			messages: index >= 0 ? messages.map((m, i) => (i === index ? next : m)) : [...messages, next],
		});
	}
	connect(): Promise<void> {
		if (this.#disposed) return Promise.reject(new Error("Session has been disposed."));
		if (this.#closing) return this.#closing.then(() => this.connect());
		if (this.#pending) return this.#pending;
		if (this.snapshot.status === "connected") return Promise.resolve();
		if (!this.adapter) {
			const error = new Error("Provide a conversation adapter or session to start a call.");
			this.#update({ error });
			return Promise.reject(error);
		}
		const adapter = this.adapter,
			id = ++this.#attempt;
		const abort = (this.#abort = new AbortController());
		const current = () => id === this.#attempt && !abort.signal.aborted;
		this.#update({ status: "connecting", error: null });
		const connected = () => {
			if (current() && this.snapshot.status === "connecting")
				this.#update({ status: "connected", activity: "listening" });
		};
		const cancelled = new Promise<void>((resolve) =>
			abort.signal.addEventListener("abort", () => resolve(), { once: true })
		);
		const opening = Promise.resolve()
			.then(() => {
				if (!current()) return;
				return adapter.connect({
					signal: abort.signal,
					onConnect: connected,
					onDisconnect: () => {
						if (current()) {
							++this.#attempt;
							abort.abort();
							this.#update({
								status: "disconnected",
								activity: "idle",
								inputStream: null,
								inputLevel: 0,
								outputLevel: 0,
							});
						}
					},
					onStatusChange: (status) => {
						if (current()) this.#update({ status });
					},
					onModeChange: (mode) => {
						if (current())
							this.#update({ activity: mode === "speaking" ? "speaking" : "listening" });
					},
					onActivityChange: (activity) => {
						if (current()) this.#update({ activity });
					},
					onMessage: (message) => {
						if (current()) this.#message(message);
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
				});
			})
			.then(connected);
		const pending = Promise.race([opening, cancelled])
			.catch(async (error: unknown) => {
				if (!current()) return;
				this.#update({ status: "disconnected", activity: "idle", error: asError(error) });
				++this.#attempt;
				abort.abort();
				try {
					await adapter.disconnect();
				} catch {
					/* retain startup error */
				}
				throw error;
			})
			.finally(() => {
				if (this.#pending === pending) this.#pending = null;
			});
		this.#pending = pending;
		return pending;
	}
	disconnect(): Promise<void> {
		if (this.#closing) return this.#closing;
		++this.#attempt;
		this.#abort?.abort();
		this.#pending = null;
		this.#update({ status: "disconnecting" });
		const closing = Promise.resolve()
			.then(() => this.adapter?.disconnect())
			.catch((error) => this.#update({ error: asError(error) }))
			.finally(() => {
				this.#update({
					status: "disconnected",
					activity: "idle",
					muted: false,
					inputStream: null,
					inputLevel: 0,
					outputLevel: 0,
				});
				if (this.#closing === closing) this.#closing = null;
			});
		this.#closing = closing;
		return closing;
	}
	async #run(capability: keyof ConversationCapabilities, operation: () => void | Promise<void>) {
		const attempt = this.#attempt;
		try {
			if (this.capabilities[capability] === false) throw new UnsupportedCapabilityError(capability);
			await operation();
		} catch (error) {
			if (attempt === this.#attempt) this.#update({ error: asError(error) });
			throw error;
		}
	}
	async sendMessage(text: string) {
		if (!text.trim()) return;
		await this.connect();
		if (this.snapshot.status !== "connected") return;
		await this.#run("text", async () => {
			const message: ConversationMessage = {
				id: `sv11-local-${++this.#localId}`,
				source: "user",
				message: text,
				final: true,
			};
			this.#update({ messages: [...this.snapshot.messages, message] });
			try {
				await this.adapter!.sendMessage(text);
			} catch (error) {
				this.#update({ messages: this.snapshot.messages.filter((m) => m.id !== message.id) });
				throw error;
			}
		});
	}
	async sendContextualUpdate(text: string) {
		if (this.snapshot.status === "connected")
			await this.#run("context", () => this.adapter!.sendContextualUpdate(text));
	}
	async setMuted(muted: boolean) {
		if (this.snapshot.status !== "connected") return;
		const attempt = this.#attempt;
		await this.#run("mute", () => this.adapter!.setMuted(muted));
		if (attempt === this.#attempt && this.snapshot.status === "connected") this.#update({ muted });
	}
	async setInputDevice(deviceId: string) {
		await this.#run("inputDevice", () => {
			if (!this.adapter?.setInputDevice) throw new UnsupportedCapabilityError("inputDevice");
			return this.adapter.setInputDevice(deviceId);
		});
		this.#update({ inputDeviceId: deviceId });
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
	}
}
export const createConversationSession = (adapter: ConversationAdapter) =>
	new ConversationSession(adapter);
