import { getContext, setContext } from "svelte";
import type { TranscriptionAdapter } from "./types.js";

export type SpeechInputStatus = "idle" | "connecting" | "connected" | "stopping" | "error";
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
	// Reactive state — written by methods, read by sub-components via context.
	status: SpeechInputStatus = $state("idle");
	partialTranscript = $state("");
	committedTranscripts: string[] = $state([]);
	error: string | null = $state(null);
	size: ButtonSize = $state("default");

	// Derived fields
	isConnected = $derived(this.status === "connected");
	isConnecting = $derived(this.status === "connecting" || this.status === "stopping");
	transcript = $derived.by(() => {
		const committed = this.committedTranscripts.join(" ").trim();
		const partial = this.partialTranscript.trim();
		if (committed && partial) return `${committed} ${partial}`;
		return committed || partial;
	});

	// Non-reactive refs. Stored as plain private fields because the adapter
	// reference must NOT create a reactive dependency — swapping adapters
	// mid-recording is unsupported by design.
	#adapter: TranscriptionAdapter | null = null;
	#requestId = 0;
	#activeAdapter: TranscriptionAdapter | null = null;
	#callbacks: SpeechInputCallbacks = {};

	/**
	 * Imperatively wire the adapter + user callbacks. Called from the root
	 * component's `$effect` on every render so fresh closures are captured.
	 */
	configure(params: { adapter: TranscriptionAdapter; callbacks: SpeechInputCallbacks }): void {
		this.#adapter = params.adapter;
		this.#callbacks = params.callbacks;
	}

	start = async (): Promise<void> => {
		// Allow restart from "idle" or "error" — but not while actively recording.
		// The error path leaves status === "error"; without this, users would be
		// stuck and unable to retry after a failed start.
		if (
			!this.#adapter ||
			this.status === "connecting" ||
			this.status === "connected" ||
			this.status === "stopping"
		)
			return;
		const id = ++this.#requestId;
		const adapter = (this.#activeAdapter = this.#adapter);

		this.partialTranscript = "";
		this.committedTranscripts = [];
		this.error = null;
		this.status = "connecting";

		try {
			await adapter.start({
				onConnect: () => {
					if (this.#requestId !== id || this.status !== "connecting") return;
					this.status = "connected";
					this.#callbacks.onStart?.(this.#data());
				},
				onPartialTranscript: (text) => {
					if (this.#requestId !== id) return;
					this.partialTranscript = text;
					this.#callbacks.onChange?.(this.#data());
				},
				onCommittedTranscript: (text) => {
					if (this.#requestId !== id) return;
					this.committedTranscripts = [...this.committedTranscripts, text];
					this.partialTranscript = "";
					this.#callbacks.onChange?.(this.#data());
				},
				onDisconnect: () => {
					if (this.#requestId !== id) return;
					if (this.status === "connected") {
						this.status = "idle";
					}
				},
				onError: (err) => this.#fail(err, id),
			});
			if (this.#requestId === id && this.status === "connecting") {
				this.status = "connected";
				this.#callbacks.onStart?.(this.#data());
			}
		} catch (err) {
			this.#fail(err instanceof Error ? err : new Error(String(err)), id);
		}
	};

	stop = async (): Promise<void> => {
		if (this.status === "idle" || this.status === "stopping") return;
		const id = this.status === "connecting" ? ++this.#requestId : this.#requestId;
		this.status = "stopping";
		try {
			await this.#activeAdapter?.stop();
			if (id !== this.#requestId) return;
			++this.#requestId;
			this.status = "idle";
			this.#callbacks.onStop?.(this.#data());
		} catch (cause) {
			this.#fail(cause instanceof Error ? cause : new Error(String(cause)), id);
		}
	};

	#fail(error: Error, id: number) {
		if (id !== this.#requestId) return;
		++this.#requestId;
		this.status = "error";
		this.error = error.message;
		try {
			void Promise.resolve(this.#activeAdapter?.cancel()).catch(() => {});
		} catch {
			/* Preserve the original failure. */
		}
		this.#callbacks.onError?.(error);
	}
	cancel = (): void => {
		const id = ++this.#requestId;
		const data = this.#data();
		const report = (cause: unknown) => {
			if (id !== this.#requestId) return;
			const error = cause instanceof Error ? cause : new Error(String(cause));
			this.error = error.message;
			this.#callbacks.onError?.(error);
		};
		try {
			void Promise.resolve(this.#activeAdapter?.cancel()).catch(report);
		} catch (cause) {
			report(cause);
		}
		this.partialTranscript = "";
		this.committedTranscripts = [];
		this.status = "idle";
		this.#callbacks.onCancel?.(data);
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
