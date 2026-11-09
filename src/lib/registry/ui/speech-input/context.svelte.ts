import { getContext, setContext } from "svelte";
import type { TranscriptionAdapter } from "./types.js";

export type SpeechInputStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "stopping"
	| "cancelling"
	| "error";
export type ButtonSize = "default" | "sm" | "lg";

export interface SpeechInputData {
	partialTranscript: string;
	committedTranscripts: string[];
	transcript: string;
}

export interface SpeechInputCallbacks {
	onStart?: (data: SpeechInputData) => void;
	onStop?: (data: SpeechInputData) => void;
	onCancel?: (data: SpeechInputData) => void;
	onChange?: (data: SpeechInputData) => void;
	onError?: (error: Error) => void;
}

const SPEECH_INPUT_CONTEXT_KEY = Symbol("sv11-speech-input");

export class SpeechInputState {
	status: SpeechInputStatus = $state("idle");
	partialTranscript = $state("");
	committedTranscripts: string[] = $state([]);
	error: string | null = $state(null);
	size: ButtonSize = $state("default");

	isConnected = $derived(this.status === "connected");
	isConnecting = $derived(this.status === "connecting");
	isBusy = $derived(
		this.isConnecting || this.status === "stopping" || this.status === "cancelling"
	);
	canCancel = $derived(this.isConnecting || this.isConnected || this.status === "stopping");
	transcript = $derived.by(() => {
		const committed = this.committedTranscripts.join(" ").trim();
		const partial = this.partialTranscript.trim();
		return committed && partial ? `${committed} ${partial}` : committed || partial;
	});

	#adapter: TranscriptionAdapter | null = null;
	#activeAdapter: TranscriptionAdapter | null = null;
	#requestId = 0;
	#closing: Promise<void> | null = null;
	#stopping: Promise<void> | null = null;
	#disposed = false;
	#callbacks: SpeechInputCallbacks = {};

	configure(params: { adapter: TranscriptionAdapter; callbacks: SpeechInputCallbacks }): void {
		this.#adapter = params.adapter;
		this.#callbacks = params.callbacks;
	}

	#isCurrent(id: number) {
		return id === this.#requestId && !this.#disposed;
	}

	#markConnected(id: number) {
		if (!this.#isCurrent(id) || this.status !== "connecting") return;
		this.status = "connected";
		this.#callbacks.onStart?.(this.#data());
	}

	#cancelActiveAdapter(): Promise<void> {
		const adapter = this.#activeAdapter;
		this.#activeAdapter = null;
		if (!adapter) return this.#closing ?? Promise.resolve();
		const closing = Promise.resolve().then(() => adapter.cancel());
		this.#closing = closing;
		const clearClosing = () => {
			if (this.#closing === closing) this.#closing = null;
		};
		void closing.then(clearClosing, clearClosing);
		return closing;
	}

	start = async (): Promise<void> => {
		if (
			!this.#adapter ||
			this.#disposed ||
			this.status === "connecting" ||
			this.status === "connected" ||
			this.status === "stopping"
		)
			return;
		const id = ++this.#requestId;
		const adapter = this.#adapter;
		try {
			await this.#closing;
		} catch (cause) {
			this.#fail(cause, id);
			return;
		}
		if (!this.#isCurrent(id)) return;
		this.#activeAdapter = adapter;
		this.partialTranscript = "";
		this.committedTranscripts = [];
		this.error = null;
		this.status = "connecting";

		try {
			await adapter.start({
				onConnect: () => this.#markConnected(id),
				onPartialTranscript: (text) => {
					if (!this.#isCurrent(id)) return;
					this.partialTranscript = text;
					this.#callbacks.onChange?.(this.#data());
				},
				onCommittedTranscript: (text) => {
					if (!this.#isCurrent(id)) return;
					this.committedTranscripts = [...this.committedTranscripts, text];
					this.partialTranscript = "";
					this.#callbacks.onChange?.(this.#data());
				},
				onDisconnect: () => {
					if (!this.#isCurrent(id) || this.status === "stopping") return;
					const closedId = ++this.#requestId;
					this.status = "idle";
					void this.#cancelActiveAdapter().catch((cause) => this.#fail(cause, closedId));
				},
				onError: (error) => this.#fail(error, id),
			});
			this.#markConnected(id);
		} catch (cause) {
			this.#fail(cause, id);
		}
	};

	stop = (): Promise<void> => {
		if (this.#stopping) return this.#stopping;
		if (this.status === "idle" || this.status === "error" || this.status === "cancelling")
			return this.#closing?.catch(() => {}) ?? Promise.resolve();
		const cancelStartup = this.status === "connecting";
		const id = cancelStartup ? ++this.#requestId : this.#requestId;
		const adapter = this.#activeAdapter;
		this.status = "stopping";
		const stopping = (async () => {
			try {
				if (cancelStartup) await this.#cancelActiveAdapter();
				else await adapter?.stop();
				if (!this.#isCurrent(id)) return;
				++this.#requestId;
				this.#activeAdapter = null;
				this.status = "idle";
				this.#callbacks.onStop?.(this.#data());
			} catch (cause) {
				this.#fail(cause, id);
			}
		})();
		this.#stopping = stopping;
		void stopping.then(() => {
			if (this.#stopping === stopping) this.#stopping = null;
		});
		return stopping;
	};

	#fail(cause: unknown, id: number) {
		if (!this.#isCurrent(id)) return;
		const error = cause instanceof Error ? cause : new Error(String(cause));
		++this.#requestId;
		this.#stopping = null;
		this.status = "error";
		this.error = error.message;
		void this.#cancelActiveAdapter().catch(() => {});
		this.#callbacks.onError?.(error);
	}

	cancel = (): Promise<void> => {
		const id = ++this.#requestId;
		const data = this.#data();
		this.#stopping = null;
		this.partialTranscript = "";
		this.committedTranscripts = [];
		this.status = "cancelling";
		const closing = this.#cancelActiveAdapter();
		this.#callbacks.onCancel?.(data);
		return closing.then(
			() => {
				if (id === this.#requestId) this.status = "idle";
			},
			(cause) => this.#fail(cause, id)
		);
	};

	dispose = (): Promise<void> => {
		this.#disposed = true;
		if (!this.#activeAdapter && !this.#closing) return Promise.resolve();
		return this.cancel();
	};

	#data = (): SpeechInputData => ({
		partialTranscript: this.partialTranscript,
		committedTranscripts: [...this.committedTranscripts],
		transcript: this.transcript,
	});
}

export function setSpeechInput(): SpeechInputState {
	const state = new SpeechInputState();
	setContext(SPEECH_INPUT_CONTEXT_KEY, state);
	return state;
}

export function useSpeechInput(): SpeechInputState {
	const ctx = getContext<SpeechInputState | undefined>(SPEECH_INPUT_CONTEXT_KEY);
	if (!ctx) {
		throw new Error("useSpeechInput must be called within a <SpeechInput>");
	}
	return ctx;
}
