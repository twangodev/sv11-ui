import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { RTVIEvent, type PipecatClient } from "@pipecat-ai/client-js";
import { type Room } from "livekit-client";
import { createPipecatConversation } from "../../src/lib/registry/ui/voice-session/adapters/pipecat.js";
import { createLiveKitConversation } from "../../src/lib/registry/ui/voice-session/adapters/livekit.js";
import { ConversationSession } from "../../src/lib/registry/ui/voice-session/session.js";

describe("Pipecat transport bridge", () => {
	it("normalizes transcripts, levels, context-only updates and device controls", async () => {
		const client = Object.assign(new EventEmitter(), {
			connect: vi.fn(),
			disconnect: vi.fn(),
			sendText: vi.fn(),
			enableMic: vi.fn(),
			updateMic: vi.fn(),
		});
		const adapter = createPipecatConversation(client as unknown as PipecatClient, async () => ({
			url: "test",
		}));
		const session = new ConversationSession(adapter);
		await session.connect();
		client.emit(RTVIEvent.UserInput, { text: "hel", final: false, user_id: "user" });
		client.emit(RTVIEvent.UserInput, { text: "hello", final: true, user_id: "user" });
		client.emit(RTVIEvent.BotOutput, { text: "hi", segment_id: 10, output_type: "sentence" });
		client.emit(RTVIEvent.BotOutput, { text: "hi", segment_id: 10, output_type: "word" });
		expect(session.snapshot.messages.map((m) => m.message)).toEqual(["hello", "hi"]);
		client.emit(RTVIEvent.LocalAudioLevel, 0.4);
		expect(session.getInputVolume()).toBe(0.4);
		client.emit(RTVIEvent.BotStartedSpeaking);
		expect(session.snapshot.activity).toBe("speaking");
		await session.sendContextualUpdate("page changed");
		expect(client.sendText).toHaveBeenCalledWith("page changed", { run_immediately: false });
		await session.setInputDevice("mic-2");
		expect(client.updateMic).toHaveBeenCalledWith("mic-2");
		await session.setMuted(true);
		expect(client.enableMic).toHaveBeenCalledWith(false);
		await session.disconnect();
		expect(client.eventNames()).toEqual([]);
	});
});

describe("LiveKit transport bridge", () => {
	function fakeRoom() {
		const handlers = new Map<string, (reader: unknown, participant: unknown) => Promise<void>>();
		const local = {
			identity: "user",
			audioLevel: 0.2,
			sendText: vi.fn(),
			setMicrophoneEnabled: vi.fn(),
			getTrackPublication: vi.fn(),
		};
		const room = Object.assign(new EventEmitter(), {
			connect: vi.fn(),
			disconnect: vi.fn(),
			switchActiveDevice: vi.fn(),
			localParticipant: local,
			remoteParticipants: new Map([
				[
					"agent",
					{
						identity: "agent",
						isAgent: true,
						audioLevel: 0.8,
						attributes: { "lk.agent.state": "thinking" },
					},
				],
			]),
			registerTextStreamHandler: (
				topic: string,
				callback: (reader: unknown, participant: unknown) => Promise<void>
			) => handlers.set(topic, callback),
			unregisterTextStreamHandler: (topic: string) => handlers.delete(topic),
		});
		return { room, handlers, local };
	}
	it("uses modern text streams and updates one transcript throughout streaming", async () => {
		const f = fakeRoom();
		const session = new ConversationSession(
			createLiveKitConversation({
				room: f.room as unknown as Room,
				connect: async () => ({ url: "wss://room", token: "ephemeral" }),
			})
		);
		await session.connect();
		expect(session.snapshot.activity).toBe("thinking");
		const reader = {
			info: { id: "turn-1" },
			async *[Symbol.asyncIterator]() {
				yield "hel";
				yield "lo";
			},
		};
		await f.handlers.get("lk.transcription")!(reader, { identity: "agent" });
		expect(session.snapshot.messages).toEqual([
			{ id: "livekit-1-agent-text-turn-1", source: "ai", message: "hello", final: true },
		]);
		await session.sendMessage("hi");
		expect(f.local.sendText).toHaveBeenCalledWith("hi", { topic: "lk.chat" });
		expect(session.getOutputVolume()).toBe(0.8);
		await expect(session.sendContextualUpdate("context")).rejects.toThrow(
			"does not support context"
		);
		await session.disconnect();
		expect(f.handlers.size).toBe(0);
		expect(f.room.eventNames()).toEqual([]);
	});
	it("waits for explicit application context RPC when configured", async () => {
		const f = fakeRoom(),
			updateContext = vi.fn().mockResolvedValue(undefined);
		const session = new ConversationSession(
			createLiveKitConversation({
				room: f.room as unknown as Room,
				connect: async () => ({ url: "wss://room", token: "token" }),
				updateContext,
			})
		);
		await session.connect();
		await session.sendContextualUpdate("new page");
		expect(updateContext).toHaveBeenCalledWith(f.room, "new page");
		await session.disconnect();
	});
	it("reconciles separate interim/final streams and ignores late interim chunks", async () => {
		const f = fakeRoom();
		const session = new ConversationSession(
			createLiveKitConversation({
				room: f.room as unknown as Room,
				connect: async () => ({ url: "wss://room", token: "token" }),
			})
		);
		await session.connect();
		let resume!: () => void;
		const wait = new Promise<void>((resolve) => (resume = resolve));
		const interim = {
			info: {
				id: "interim",
				attributes: { "lk.segment_id": "segment", "lk.transcription_final": "false" },
			},
			async *[Symbol.asyncIterator]() {
				yield "hel";
				await wait;
				yield "late";
			},
		};
		const pending = f.handlers.get("lk.transcription")!(interim, { identity: "user" });
		await Promise.resolve();
		await Promise.resolve();
		const final = {
			info: {
				id: "final",
				attributes: { "lk.segment_id": "segment", "lk.transcription_final": "true" },
			},
			async *[Symbol.asyncIterator]() {
				yield "hello final";
			},
		};
		await f.handlers.get("lk.transcription")!(final, { identity: "user" });
		resume();
		await pending;
		expect(session.snapshot.messages).toHaveLength(1);
		expect(session.snapshot.messages[0]).toMatchObject({ message: "hello final", final: true });
		await session.disconnect();
	});
});
