import VoiceNav01 from "./voice-nav-01.svelte";

export { VoiceNav01, VoiceNav01 as default };
export type { VoiceNav01Props, VoiceNavResolver } from "./voice-nav-01.svelte";
export { DEFAULT_DESTINATIONS, matchDestination } from "./destinations.js";
export type { VoiceNavDestination } from "./destinations.js";
export { OneShotRecognizer, getSpeechRecognition, isSpeechRecognitionSupported } from "./speech.js";
