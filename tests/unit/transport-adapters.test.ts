import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RTVIEvent, type PipecatClient } from "@pipecat-ai/client-js";
import { RoomEvent, TrackEvent, type Room } from "livekit-client";
import { createPipecatConversation } from "../../src/lib/registry/ui/voice-session/adapters/pipecat.js";
import { createLiveKitConversation } from "../../src/lib/registry/ui/voice-session/adapters/livekit.js";
import { ConversationSession } from "../../src/lib/registry/ui/voice-session/session.js";

afterEach(() => vi.unstubAllGlobals());

describe("Pipecat transport bridge", () => {
	it("normalizes transcripts, levels, context-only updates and device controls", async () => {
		const client = Object.assign(new EventEmitter(), {
			connect: vi.fn().mockResolvedValue(undefined),
			disconnect: vi.fn().mockResolvedValue(undefined),
			sendText: vi.fn(),
			enableMic: vi.fn(),
			updateMic: vi.fn(),
		});
		const updateContext = vi.fn();
		const adapter = createPipecatConversation(
			client as unknown as PipecatClient,
			async () => ({ url: "test" }),
			{ updateContext }
		);
		const session = new ConversationSession(adapter);
		await session.connect();
		client.emit(RTVIEvent.UserInput, { text: "hel", final: false, user_id: "user" });
		client.emit(RTVIEvent.UserInput, { text: "hello", final: true, user_id: "user" });
		client.emit(RTVIEvent.BotOutput, { text: "hi", segment_id: 10, output_type: "sentence" });
		client.emit(RTVIEvent.BotOutput, { text: "hi", segment_id: 10, output_type: "word" });
		client.emit(RTVIEvent.BotOutput, {
			text: "300",
			segment_id: 11,
			output_type: "expression_pause",
		});
		client.emit(RTVIEvent.UserInput, {
			input_type: "transcription",
			msg_id: "spoken-2",
			text: "bye",
			final: false,
		});
		expect(session.snapshot.messages.at(-1)?.final).toBe(false);
		client.emit(RTVIEvent.UserInput, {
			input_type: "transcription",
			msg_id: "spoken-2",
			text: "goodbye",
			final: true,
		});
		expect(session.snapshot.messages.map((m) => m.message)).toEqual(["hello", "hi", "goodbye"]);
		client.emit(RTVIEvent.LocalAudioLevel, 0.4);
		expect(session.getInputVolume()).toBe(0.4);
		client.emit(RTVIEvent.BotStartedSpeaking);
		expect(session.snapshot.activity).toBe("speaking");
		await session.sendContextualUpdate("page changed");
		expect(updateContext).toHaveBeenCalledWith(client, "page changed");
		expect(client.sendText).not.toHaveBeenCalled();
		await session.setInputDevice("mic-2");
		expect(client.updateMic).toHaveBeenCalledWith("mic-2");
		await session.setMuted(true);
		expect(client.enableMic).toHaveBeenCalledWith(false);
		await session.disconnect();
		expect(client.eventNames()).toEqual([]);
		expect(() => adapter.setInputDevice!("mic-3")).toThrow("Connect the Pipecat session");
	});
	it("cleans remote disconnects and correlates typed acknowledgements across reconnects", async () => {
		const client = Object.assign(new EventEmitter(), {
			connect: vi.fn().mockResolvedValue(undefined),
			disconnect: vi.fn().mockResolvedValue(undefined),
			enableMic: vi.fn(),
			updateMic: vi.fn(),
			sendText: vi.fn(async (text: string) => {
				client.emit(RTVIEvent.UserInput, {
					msg_id: "typed-1",
					input_type: "chat",
					text,
					final: true,
				});
				return "typed-1";
			}),
		});
		const adapter = createPipecatConversation(client as unknown as PipecatClient, () => ({}));
		const session = new ConversationSession(adapter);
		await session.connect();
		await session.sendMessage("hello");
		client.emit(RTVIEvent.UserInput, {
			msg_id: "typed-1",
			input_type: "chat",
			text: "hello",
			final: true,
		});
		expect(session.snapshot.messages).toHaveLength(1);
		await expect(session.sendContextualUpdate("draft")).rejects.toThrow("does not support context");
		client.emit(RTVIEvent.Disconnected);
		expect(client.eventNames()).toEqual([]);
		await session.connect();
		expect(client.listenerCount(RTVIEvent.UserInput)).toBe(1);
		client.emit(RTVIEvent.UserInput, { text: "hel", final: false });
		client.emit(RTVIEvent.UserInput, { text: "hello", final: true });
		expect(session.snapshot.messages.map((message) => message.message)).toEqual(["hello", "hello"]);
		await session.disconnect();
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
			connect: vi.fn().mockResolvedValue(undefined),
			disconnect: vi.fn().mockResolvedValue(undefined),
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
			) => {
				if (handlers.has(topic)) throw new Error(`Handler already registered: ${topic}`);
				handlers.set(topic, callback);
			},
			unregisterTextStreamHandler: (topic: string) => handlers.delete(topic),
		});
		return { room, handlers, local };
	}
	it("uses modern text streams and updates one transcript throughout streaming", async () => {
		const f = fakeRoom();
		const session = new ConversationSession(
			createLiveKitConversation({
				room: f.room as unknown as Room,
				agentIdentity: "agent",
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
		await f.handlers.get("lk.transcription")!(reader, { identity: "other-agent" });
		expect(session.snapshot.messages).toEqual([]);
		await f.handlers.get("lk.transcription")!(reader, { identity: "agent" });
		const element = {
			play: vi.fn().mockResolvedValue(undefined),
			pause: vi.fn(),
			remove: vi.fn(),
			srcObject: null,
		};
		const track = { kind: "audio", attach: vi.fn(() => element), detach: vi.fn() };
		f.room.emit(RoomEvent.TrackSubscribed, track, {}, { identity: "other-agent" });
		expect(track.attach).not.toHaveBeenCalled();
		f.room.emit(RoomEvent.TrackSubscribed, track, {}, { identity: "agent" });
		expect(track.attach).toHaveBeenCalledOnce();
		f.room.emit(RoomEvent.TrackUnsubscribed, track);
		expect(track.detach).toHaveBeenCalledWith(element);
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
	it("releases remote-disconnect handlers before reconnect and ignores old stream callbacks", async () => {
		const f = fakeRoom();
		const session = new ConversationSession(
			createLiveKitConversation({
				room: f.room as unknown as Room,
				connect: async () => ({ url: "wss://room", token: "token" }),
			})
		);
		await session.connect();
		const oldHandler = f.handlers.get("lk.chat")!;
		f.room.emit(RoomEvent.Disconnected);
		expect(f.handlers.size).toBe(0);
		expect(f.room.eventNames()).toEqual([]);
		await session.connect();
		expect(f.handlers.size).toBe(2);
		expect(f.room.listenerCount(RoomEvent.Disconnected)).toBe(1);
		await oldHandler(
			{
				info: { id: "stale" },
				async *[Symbol.asyncIterator]() {
					yield "stale text";
				},
			},
			{ identity: "agent" }
		);
		expect(session.snapshot.messages).toEqual([]);
		await session.disconnect();
	});

	it("republishes replaced microphone tracks and rejects device changes after disconnect", async () => {
		vi.stubGlobal(
			"MediaStream",
			class {
				constructor(readonly tracks: MediaStreamTrack[]) {}
				getTracks() {
					return this.tracks;
				}
			}
		);
		const f = fakeRoom();
		const microphone = Object.assign(new EventEmitter(), { mediaStreamTrack: { id: "first" } });
		f.local.getTrackPublication.mockReturnValue({ track: microphone });
		const adapter = createLiveKitConversation({
			room: f.room as unknown as Room,
			connect: async () => ({ url: "wss://room", token: "token" }),
		});
		const session = new ConversationSession(adapter);
		await session.connect();
		expect(session.snapshot.inputStream?.getTracks()[0]).toEqual({ id: "first" });
		f.room.switchActiveDevice.mockImplementation(async () => {
			microphone.mediaStreamTrack = { id: "second" };
		});
		await session.setInputDevice("mic-2");
		expect(session.snapshot.inputStream?.getTracks()[0]).toEqual({ id: "second" });
		microphone.mediaStreamTrack = { id: "third" };
		microphone.emit(TrackEvent.Restarted);
		expect(session.snapshot.inputStream?.getTracks()[0]).toEqual({ id: "third" });
		f.local.getTrackPublication.mockReturnValue(undefined);
		f.room.emit(RoomEvent.LocalTrackUnpublished);
		expect(session.snapshot.inputStream).toBeNull();
		expect(microphone.listenerCount(TrackEvent.Restarted)).toBe(0);
		await session.disconnect();
		await expect(adapter.setInputDevice!("mic-3")).rejects.toThrow("Connect the LiveKit session");
		expect(f.room.switchActiveDevice).toHaveBeenCalledOnce();
	});
});
