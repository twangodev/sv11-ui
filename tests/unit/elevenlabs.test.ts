import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createElevenLabsConversation,
	createElevenLabsTranscription,
} from "../../src/lib/registry/ui/voice-session/adapters/elevenlabs.js";
import type { ConversationConfig } from "../../src/lib/registry/ui/voice-session/types.js";

const sdk = vi.hoisted(() => ({
	start: vi.fn(),
	scribe: vi.fn(),
	events: new Map<string, (data?: unknown) => void>(),
	close: vi.fn(),
	commit: vi.fn(),
}));
vi.mock("@elevenlabs/client", () => ({
	Conversation: { startSession: sdk.start },
	Scribe: { connect: sdk.scribe },
	CommitStrategy: { VAD: "vad" },
	RealtimeEvents: {
		SESSION_STARTED: "ready",
		PARTIAL_TRANSCRIPT: "partial",
		COMMITTED_TRANSCRIPT: "final",
		ERROR: "error",
		AUTH_ERROR: "auth",
		QUOTA_EXCEEDED: "quota",
		CLOSE: "close",
	},
}));
function callbacks(): ConversationConfig {
	return {
		onConnect: vi.fn(),
		onDisconnect: vi.fn(),
		onMessage: vi.fn(),
		onError: vi.fn(),
		onStatusChange: vi.fn(),
		onModeChange: vi.fn(),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	sdk.events.clear();
	sdk.scribe.mockReturnValue({
		on: (name: string, handler: (data?: unknown) => void) => sdk.events.set(name, handler),
		close: sdk.close,
		commit: sdk.commit,
		send: vi.fn(),
	});
});
describe("ElevenLabs SDK bridge", () => {
	it("forwards native messages, controls and level meters", async () => {
		const native = {
			endSession: vi.fn(),
			sendUserMessage: vi.fn(),
			sendContextualUpdate: vi.fn(),
			setMicMuted: vi.fn(),
			getInputVolume: () => 0.2,
			getOutputVolume: () => 0.7,
			changeInputDevice: vi.fn(),
		};
		sdk.start.mockResolvedValue(native);
		const adapter = createElevenLabsConversation(async () => ({ agentId: "test" })),
			cb = callbacks();
		await adapter.connect(cb);
		const options = sdk.start.mock.calls[0][0];
		options.onMessage({ source: "ai", message: "hello", event_id: 42 });
		options.onModeChange({ mode: "speaking" });
		expect(cb.onMessage).toHaveBeenCalledWith({
			id: "elevenlabs-ai-42",
			source: "ai",
			message: "hello",
			final: true,
		});
		adapter.sendMessage("hi");
		adapter.setMuted(true);
		await adapter.setInputDevice?.("mic-2");
		expect(native.sendUserMessage).toHaveBeenCalledWith("hi");
		expect(native.setMicMuted).toHaveBeenCalledWith(true);
		expect(native.changeInputDevice).toHaveBeenCalledWith({ inputDeviceId: "mic-2" });
		expect(adapter.getOutputVolume?.()).toBe(0.7);
		await adapter.disconnect();
		expect(native.endSession).toHaveBeenCalledOnce();
	});
	it("ends a session whose SDK startup resolves after cancellation", async () => {
		let finish!: (native: unknown) => void;
		sdk.start.mockReturnValue(new Promise((resolve) => (finish = resolve)));
		const adapter = createElevenLabsConversation(async () => ({ agentId: "test" }));
		const controller = new AbortController();
		const opening = adapter.connect({ ...callbacks(), signal: controller.signal });
		await Promise.resolve();
		controller.abort();
		await adapter.disconnect();
		const endSession = vi.fn();
		finish({ endSession });
		await opening;
		expect(endSession).toHaveBeenCalledOnce();
	});
	it("waits for the final committed transcript before closing Scribe", async () => {
		const adapter = createElevenLabsTranscription({ getToken: async () => "ephemeral" });
		const committed = vi.fn();
		const opening = adapter.start({ onCommittedTranscript: committed });
		await vi.waitFor(() => expect(sdk.events.has("ready")).toBe(true));
		sdk.events.get("ready")?.();
		await opening;
		sdk.events.get("partial")?.({ text: "hel" });
		const stopping = adapter.stop();
		expect(sdk.commit).toHaveBeenCalledOnce();
		expect(sdk.close).not.toHaveBeenCalled();
		sdk.events.get("final")?.({ text: "hello" });
		await stopping;
		expect(committed).toHaveBeenCalledWith("hello");
		expect(sdk.close).toHaveBeenCalledOnce();
	});
	it("rejects authentication failure during Scribe startup", async () => {
		const adapter = createElevenLabsTranscription({ getToken: async () => "expired" });
		const opening = adapter.start({});
		await vi.waitFor(() => expect(sdk.events.has("ready")).toBe(true));
		sdk.events.get("error")?.({ error: "invalid token", message_type: "auth_error" });
		await expect(opening).rejects.toThrow("invalid token");
		adapter.cancel();
	});
	it("cancels pending Scribe initialization and ignores late transcripts", async () => {
		const adapter = createElevenLabsTranscription({ getToken: async () => "token" }),
			committed = vi.fn();
		const opening = adapter.start({ onCommittedTranscript: committed });
		await vi.waitFor(() => expect(sdk.events.has("ready")).toBe(true));
		adapter.cancel();
		await opening;
		sdk.events.get("final")?.({ text: "late" });
		expect(committed).not.toHaveBeenCalled();
	});

	it("settles startup when cancelled while fetching a token", async () => {
		const adapter = createElevenLabsTranscription({ getToken: () => new Promise(() => {}) });
		const opening = adapter.start({});
		adapter.cancel();
		await opening;
		expect(sdk.scribe).not.toHaveBeenCalled();
	});

	it("reports unexpected closure while waiting for a finalized phrase", async () => {
		const adapter = createElevenLabsTranscription({ getToken: async () => "token" });
		const opening = adapter.start({});
		await vi.waitFor(() => expect(sdk.events.has("ready")).toBe(true));
		sdk.events.get("ready")?.();
		await opening;
		sdk.events.get("partial")?.({ text: "pending" });
		const stopping = adapter.stop();
		sdk.events.get("close")?.();
		await expect(stopping).rejects.toThrow("before finalizing");
	});
});
