// Minimal Web Speech API surface (not in the default TS DOM lib). Used as the
// zero-backend demo speech source; supply a `transcribe` prop for production.

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative };
type SpeechRecognitionEvent = {
	results: { length: number; [index: number]: SpeechRecognitionResult };
};
interface SpeechRecognitionLike {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	maxAlternatives: number;
	start(): void;
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

/**
 * One-shot recognizer: resolves with a single utterance's transcript. `abort()`
 * cancels an in-flight recognition (used when the user taps to stop).
 */
export class OneShotRecognizer {
	#recognition: SpeechRecognitionLike | null = null;

	start(lang = "en-US"): Promise<string> {
		return new Promise((resolve, reject) => {
			const Ctor = getSpeechRecognition();
			if (!Ctor) {
				reject(new Error("SpeechRecognition is not supported in this browser."));
				return;
			}
			const recognition = new Ctor();
			recognition.continuous = false;
			recognition.interimResults = false;
			recognition.lang = lang;
			recognition.maxAlternatives = 1;

			let transcript = "";
			let failed = false;
			recognition.onresult = (event) => {
				transcript = event.results[0]?.[0]?.transcript ?? "";
			};
			recognition.onerror = (event) => {
				if (event.error === "no-speech" || event.error === "aborted") return;
				failed = true;
				reject(new Error(`Speech recognition error: ${event.error}`));
			};
			recognition.onend = () => {
				this.#recognition = null;
				if (!failed) resolve(transcript.trim());
			};

			this.#recognition = recognition;
			recognition.start();
		});
	}

	abort(): void {
		this.#recognition?.abort();
		this.#recognition = null;
	}
}
