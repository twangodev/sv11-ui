import RealtimeTranscriber01 from "./realtime-transcriber-01.svelte";

export { RealtimeTranscriber01, RealtimeTranscriber01 as default };
export type { RealtimeTranscriber01Props } from "./realtime-transcriber-01.svelte";
export {
	createWebSpeechAdapter,
	getSpeechRecognition,
	isSpeechRecognitionSupported,
} from "./adapter.js";
export type { TranscriptionAdapter, TranscriptionAdapterCallbacks } from "./adapter.js";
export { LANGUAGES } from "./languages.js";
export type { Language } from "./languages.js";
