// Minimal Web Speech API surface. These types are not part of the default
// TypeScript DOM lib, so we declare just what this block uses. The block uses
// the browser's SpeechRecognition as a zero-backend demo transcriber; swap in a
// real provider by passing the `transcribe` prop on <Transcriber01>.

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean };
type SpeechRecognitionResultList = {
	length: number;
	[index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEvent = {
	resultIndex: number;
	results: SpeechRecognitionResultList;
};

export interface SpeechRecognitionLike {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
	abort(): void;
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

export interface SpeechSessionCallbacks {
	/** Fired with the running interim (not-yet-final) transcript. */
	onPartial?: (text: string) => void;
	/** Fired each time a phrase is finalized, with the full committed text. */
	onFinal?: (text: string) => void;
	onError?: (error: Error) => void;
}

/**
 * Thin wrapper over the browser SpeechRecognition that accumulates committed
 * text and surfaces interim results. Used as the demo STT for the transcriber
 * blocks — no API key, runs entirely in the browser (Chromium-based).
 */
export class SpeechSession {
	#recognition: SpeechRecognitionLike | null = null;
	#committed = "";

	get committed() {
		return this.#committed;
	}

	start(lang: string, callbacks: SpeechSessionCallbacks): void {
		const Ctor = getSpeechRecognition();
		if (!Ctor) {
			callbacks.onError?.(new Error("SpeechRecognition is not supported in this browser."));
			return;
		}
		this.#committed = "";
		const recognition = new Ctor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = lang;

		recognition.onresult = (event) => {
			let interim = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const text = result[0].transcript;
				if (result.isFinal) {
					this.#committed = (this.#committed + " " + text).trim();
					callbacks.onFinal?.(this.#committed);
				} else {
					interim += text;
				}
			}
			if (interim) callbacks.onPartial?.((this.#committed + " " + interim).trim());
		};
		recognition.onerror = (event) => {
			// "no-speech" / "aborted" are benign stop conditions, not failures.
			if (event.error !== "no-speech" && event.error !== "aborted") {
				callbacks.onError?.(new Error(`Speech recognition error: ${event.error}`));
			}
		};

		this.#recognition = recognition;
		recognition.start();
	}

	stop(): void {
		this.#recognition?.stop();
		this.#recognition = null;
	}

	abort(): void {
		this.#recognition?.abort();
		this.#recognition = null;
	}
}
