import type {
	TranscriptionAdapter,
	TranscriptionAdapterCallbacks,
} from "$lib/registry/ui/voice-session/types.js";
export type { TranscriptionAdapter, TranscriptionAdapterCallbacks };

// --- Web Speech API (not in the default TS DOM lib) ---

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean };
type SpeechRecognitionEvent = {
	resultIndex: number;
	results: { length: number; [index: number]: SpeechRecognitionResult };
};
interface SpeechRecognitionLike {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
	abort(): void;
	onstart: (() => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
	if (typeof window === "undefined") return null;
	const w = window as unknown as {
		SpeechRecognition?: SpeechRecognitionCtor;
		webkitSpeechRecognition?: SpeechRecognitionCtor;
	};
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const isSpeechRecognitionSupported = () => getSpeechRecognition() !== null;

/** Browser SpeechRecognition fallback (Chromium); restarts after silence until stop or cancel. */
export function createWebSpeechAdapter(lang = "en-US"): TranscriptionAdapter {
	type RecognitionRun = {
		recognition: SpeechRecognitionLike;
		callbacks: TranscriptionAdapterCallbacks;
		opening: { resolve: () => void; reject: (error: Error) => void } | null;
		stopping: boolean;
		stopPromise?: Promise<void>;
		finishStop?: (error?: Error, abort?: boolean) => void;
	};
	let active: RecognitionRun | undefined;
	const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

	function release(current: RecognitionRun, abort: boolean) {
		if (active === current) active = undefined;
		const recognition = current.recognition;
		recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
		if (abort) {
			try {
				recognition.abort();
			} catch {
				/* Already ended. */
			}
		}
	}

	function cancel() {
		const current = active;
		if (!current) return;
		current.stopping = true;
		release(current, true);
		current.opening?.resolve();
		current.opening = null;
		current.finishStop?.(new DOMException("Transcription cancelled", "AbortError"));
	}

	return {
		start(callbacks) {
			cancel();
			return new Promise<void>((resolve, reject) => {
				const Ctor = getSpeechRecognition();
				if (!Ctor) {
					reject(new Error("SpeechRecognition is not supported in this browser."));
					return;
				}
				const recognition = new Ctor();
				const current: RecognitionRun = {
					recognition,
					callbacks,
					opening: { resolve, reject },
					stopping: false,
				};
				active = current;
				recognition.continuous = true;
				recognition.interimResults = true;
				recognition.lang = lang;
				recognition.onstart = () => {
					if (active !== current) return;
					if (current.stopping) {
						try {
							recognition.stop();
						} catch (error) {
							current.finishStop?.(asError(error), true);
						}
						return;
					}
					const opening = current.opening;
					current.opening = null;
					callbacks.onConnect?.();
					opening?.resolve();
				};
				recognition.onresult = (event) => {
					if (active !== current) return;
					let interim = "";
					for (let i = event.resultIndex; i < event.results.length; i++) {
						const result = event.results[i];
						const text = result[0].transcript;
						if (result.isFinal) callbacks.onCommittedTranscript?.(text.trim());
						else interim += text;
					}
					callbacks.onPartialTranscript?.(interim.trim());
				};
				recognition.onerror = (event) => {
					if (active !== current || event.error === "no-speech" || event.error === "aborted")
						return;
					const error = new Error(`Speech recognition error: ${event.error}`);
					const opening = current.opening;
					current.opening = null;
					if (opening) {
						release(current, true);
						opening.reject(error);
					} else {
						const finish = current.finishStop;
						callbacks.onError?.(error);
						if (finish) finish(error, true);
						else release(current, true);
					}
				};
				recognition.onend = () => {
					if (active !== current) return;
					if (current.stopping) {
						current.finishStop?.();
						return;
					}
					try {
						recognition.start();
					} catch (error) {
						const opening = current.opening;
						current.opening = null;
						release(current, false);
						if (opening) opening.reject(asError(error));
						else callbacks.onDisconnect?.();
					}
				};
				try {
					recognition.start();
				} catch (error) {
					current.opening = null;
					release(current, true);
					reject(asError(error));
				}
			});
		},
		stop() {
			const current = active;
			if (!current) return Promise.resolve();
			if (current.stopPromise) return current.stopPromise;
			current.stopping = true;
			const opening = current.opening;
			current.opening = null;
			opening?.resolve();
			current.stopPromise = new Promise<void>((resolve, reject) => {
				let finished = false;
				const finish = (error?: Error, abort = false) => {
					if (finished) return;
					finished = true;
					clearTimeout(timer);
					current.finishStop = undefined;
					release(current, abort);
					if (error) reject(error);
					else {
						try {
							current.callbacks.onDisconnect?.();
							resolve();
						} catch (cause) {
							reject(asError(cause));
						}
					}
				};
				// Final results precede onend. Bound completion if the browser never ends.
				const timer = setTimeout(
					() => finish(new Error("Timed out waiting for transcription to finalize."), true),
					600
				);
				current.finishStop = finish;
				try {
					current.recognition.stop();
				} catch (error) {
					finish(opening ? undefined : asError(error), true);
				}
			});
			return current.stopPromise;
		},
		cancel,
	};
}
