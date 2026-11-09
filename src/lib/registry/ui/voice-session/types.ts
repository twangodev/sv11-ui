export type AgentConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting";
export type AgentActivity = "idle" | "listening" | "thinking" | "speaking";
export type ConversationMode = "speaking" | "listening";

export interface ConversationMessage {
	id?: string;
	source: "user" | "ai";
	message: string;
	/** Reuse the id to replace an interim transcript with its final text. */
	final?: boolean;
}
export interface AudioLevels {
	input: number;
	output: number;
}
export interface ConversationConfig {
	onConnect: () => void;
	onDisconnect: () => void;
	onMessage: (message: ConversationMessage) => void;
	onError: (error: Error) => void;
	onStatusChange: (status: AgentConnectionState) => void;
	onModeChange?: (mode: ConversationMode) => void;
	onActivityChange?: (activity: AgentActivity) => void;
	onAudioLevels?: (levels: AudioLevels) => void;
	onInputStream?: (stream: MediaStream | null) => void;
	signal?: AbortSignal;
}
export interface ConversationCapabilities {
	text?: boolean;
	context?: boolean;
	mute?: boolean;
	inputDevice?: boolean;
	interrupt?: boolean;
	audioLevels?: boolean;
}
export interface ConversationAdapter {
	readonly capabilities?: ConversationCapabilities;
	connect(config: ConversationConfig): Promise<void>;
	disconnect(): void | Promise<void>;
	sendMessage(text: string): void | Promise<void>;
	sendContextualUpdate(text: string): void | Promise<void>;
	setMuted(muted: boolean): void | Promise<void>;
	setInputDevice?(deviceId: string): void | Promise<void>;
	interrupt?(): void | Promise<void>;
	getInputVolume?(): number;
	getOutputVolume?(): number;
}
export interface TranscriptionAdapterCallbacks {
	onPartialTranscript?: (text: string) => void;
	onCommittedTranscript?: (text: string) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: Error) => void;
}
export interface TranscriptionAdapter {
	start(callbacks: TranscriptionAdapterCallbacks): Promise<void>;
	/** Resolve after the provider has delivered the last finalized transcript. */
	stop(): void | Promise<void>;
	cancel(): void | Promise<void>;
	commit?(): void | Promise<void>;
	sendAudio?(audio: Uint8Array): void | Promise<void>;
}
export interface TimedWord {
	text: string;
	startTime: number;
	endTime: number;
}
export type TranscribeAudio = (audio: Blob, signal?: AbortSignal) => Promise<string>;
export type ExtractFields<T> = (transcript: string, signal?: AbortSignal) => Promise<Partial<T>>;
export class UnsupportedCapabilityError extends Error {
	constructor(public readonly capability: keyof ConversationCapabilities) {
		super(`This adapter does not support ${capability}.`);
		this.name = "UnsupportedCapabilityError";
	}
}
