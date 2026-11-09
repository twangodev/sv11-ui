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
		AUDIO_STARTED: "audio",
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
	sdk.scribe.mockImplementation(() => {
		const events = new Map<string, (data?: unknown) => void>();
		sdk.events = events;
		return {
			events,
			on: (name: string, handler: (data?: unknown) => void) => events.set(name, handler),
			close: vi.fn(() => sdk.close()),
			commit: vi.fn(() => sdk.commit()),
			send: vi.fn(),
		};
	});
});
describe("ElevenLabs SDK bridge", () => {
	it("forwards native messages, controls and level meters", async () => {
		const native = {
			type: "voice",
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
		await vi.waitFor(() => expect(sdk.start).toHaveBeenCalledOnce());
		controller.abort();
		await adapter.disconnect();
		const endSession = vi.fn();
		finish({ endSession });
		await opening;
		await vi.waitFor(() => expect(endSession).toHaveBeenCalledOnce());
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
		expect(adapter.stop()).toBe(stopping);
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
	it("advertises only supported text-only controls and rejects disconnected device changes", async () => {
		const adapter = createElevenLabsConversation(async () => ({ agentId: "test", textOnly: true }));
		await expect(adapter.setInputDevice?.("mic-2")).rejects.toThrow("not connected");
		const native = {
			type: "text",
			endSession: vi.fn(),
			setMicMuted: vi.fn(),
		};
		sdk.start.mockResolvedValue(native);
		await adapter.connect(callbacks());
		expect(adapter.capabilities).toMatchObject({
			text: true,
			mute: false,
			inputDevice: false,
			audioLevels: false,
		});
		expect(() => adapter.setMuted(true)).toThrow("does not support mute");
		await expect(adapter.setInputDevice?.("mic-2")).rejects.toThrow("does not support inputDevice");
		expect(native.setMicMuted).not.toHaveBeenCalled();
		await adapter.disconnect();
	});

	it.each(["microphone", "manual"])(
		"flushes submitted %s audio before the first partial transcript",
		async (mode) => {
			const adapter = createElevenLabsTranscription({ getToken: async () => "token" });
			const committed = vi.fn();
			const opening = adapter.start({ onCommittedTranscript: committed });
			await vi.waitFor(() => expect(sdk.events.has("ready")).toBe(true));
			sdk.events.get("ready")?.();
			await opening;
			if (mode === "microphone") sdk.events.get("audio")?.();
			else adapter.sendAudio?.(new Uint8Array([1, 2, 3]));
			const stopping = adapter.stop();
			expect(sdk.commit).toHaveBeenCalledOnce();
			expect(sdk.close).not.toHaveBeenCalled();
			sdk.events.get("final")?.({ text: "complete phrase" });
			await stopping;
			expect(committed).toHaveBeenCalledWith("complete phrase");
			expect(sdk.close).toHaveBeenCalledOnce();
		}
	);

	it("keeps a restarted transcription alive when a cancelled stop finishes", async () => {
		const adapter = createElevenLabsTranscription({ getToken: async () => "token" });
		const firstOpening = adapter.start({});
		await vi.waitFor(() => expect(sdk.scribe).toHaveBeenCalledTimes(1));
		const first = sdk.scribe.mock.results[0].value;
		first.events.get("ready")?.();
		await firstOpening;
		first.events.get("partial")?.({ text: "discard" });
		const stopping = adapter.stop();
		adapter.cancel();
		const committed = vi.fn();
		const nextOpening = adapter.start({ onCommittedTranscript: committed });
		await stopping;
		await vi.waitFor(() => expect(sdk.scribe).toHaveBeenCalledTimes(2));
		const next = sdk.scribe.mock.results[1].value;
		next.events.get("ready")?.();
		await nextOpening;
		first.events.get("final")?.({ text: "stale" });
		next.events.get("final")?.({ text: "current" });
		expect(committed).toHaveBeenCalledExactlyOnceWith("current");
		expect(first.close).toHaveBeenCalledOnce();
		expect(next.close).not.toHaveBeenCalled();
		adapter.cancel();
	});

	it("queues a restart until finalization closes the preceding connection", async () => {
		const adapter = createElevenLabsTranscription({ getToken: async () => "token" });
		const opening = adapter.start({});
		expect(adapter.start({})).toBe(opening);
		await vi.waitFor(() => expect(sdk.scribe).toHaveBeenCalledTimes(1));
		sdk.events.get("ready")?.();
		await opening;
		sdk.events.get("partial")?.({ text: "pending" });
		const stopping = adapter.stop();
		const restarting = adapter.start({});
		expect(sdk.scribe).toHaveBeenCalledTimes(1);
		sdk.events.get("final")?.({ text: "done" });
		await stopping;
		await vi.waitFor(() => expect(sdk.scribe).toHaveBeenCalledTimes(2));
		sdk.events.get("ready")?.();
		await restarting;
		adapter.cancel();
	});

	it("cancels a restart queued behind a finalizing transcription", async () => {
		const adapter = createElevenLabsTranscription({ getToken: async () => "token" });
		const opening = adapter.start({});
		await vi.waitFor(() => expect(sdk.scribe).toHaveBeenCalledTimes(1));
		sdk.events.get("ready")?.();
		await opening;
		sdk.events.get("partial")?.({ text: "pending" });
		const stopping = adapter.stop();
		const restarting = adapter.start({});
		adapter.cancel();
		await Promise.all([stopping, restarting]);
		expect(sdk.scribe).toHaveBeenCalledTimes(1);
	});
});
