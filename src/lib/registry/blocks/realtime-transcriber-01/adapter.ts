// Streaming transcription adapter. The interface mirrors the one shipped with
// the `speech-input` component, so adapters are interchangeable between the two.
// Wire a real provider (ElevenLabs Scribe, Deepgram, etc.) by implementing this
// interface; the bundled Web Speech adapter is a zero-backend demo default.

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

/**
 * Demo TranscriptionAdapter backed by the browser SpeechRecognition. Runs fully
 * client-side with no API key (Chromium-based browsers). Continuous recognition
 * is kept alive by restarting on unexpected `onend` until `stop()`/`cancel()`.
 */
export function createWebSpeechAdapter(lang = "en-US"): TranscriptionAdapter {
	let recognition: SpeechRecognitionLike | null = null;
	let stopped = false;
	let cb: TranscriptionAdapterCallbacks = {};
	// Set while start() is pending; lets a startup error reject the start() Promise
	// (e.g. permission denied fires onerror before onstart ever does).
	let startup: { resolve: () => void; reject: (err: Error) => void } | null = null;

	function build() {
		const Ctor = getSpeechRecognition()!;
		const r = new Ctor();
		r.continuous = true;
		r.interimResults = true;
		r.lang = lang;
		r.onresult = (event) => {
			let interim = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const text = result[0].transcript;
				if (result.isFinal) {
					// Emit only the phrase that finalized; the consumer accumulates.
					cb.onCommittedTranscript?.(text.trim());
				} else {
					interim += text;
				}
			}
			cb.onPartialTranscript?.(interim.trim());
		};
		r.onerror = (event) => {
			if (event.error === "no-speech" || event.error === "aborted") return;
			const err = new Error(`Speech recognition error: ${event.error}`);
			// A failure before onstart means start() is still pending — reject it so
			// `await adapter.start()` callers hit their catch instead of hanging.
			if (startup) {
				const pending = startup;
				startup = null;
				pending.reject(err);
				return;
			}
			cb.onError?.(err);
		};
		r.onend = () => {
			// Continuous mode can end on its own after silence; restart until the
			// caller explicitly stops, so the session feels live.
			if (!stopped) {
				try {
					r.start();
				} catch {
					cb.onDisconnect?.();
				}
			} else {
				cb.onDisconnect?.();
			}
		};
		return r;
	}

	return {
		start(callbacks) {
			cb = callbacks;
			stopped = false;
			return new Promise<void>((resolve, reject) => {
				const Ctor = getSpeechRecognition();
				if (!Ctor) {
					reject(new Error("SpeechRecognition is not supported in this browser."));
					return;
				}
				startup = {
					resolve: () => {
						startup = null;
						resolve();
					},
					reject: (err) => {
						startup = null;
						reject(err);
					},
				};
				recognition = build();
				recognition.onstart = () => {
					cb.onConnect?.();
					startup?.resolve();
				};
				try {
					recognition.start();
				} catch (err) {
					startup = null;
					reject(err instanceof Error ? err : new Error("Failed to start recognition."));
				}
			});
		},
		stop() {
			stopped = true;
			// Settle a still-pending start() so `await adapter.start()` can't hang if
			// we stop before onstart fires.
			startup?.resolve();
			recognition?.stop();
			recognition = null;
		},
		cancel() {
			stopped = true;
			startup?.resolve();
			recognition?.abort();
			recognition = null;
		},
	};
}
