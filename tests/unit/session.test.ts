import { describe, expect, it, vi } from "vitest";
import { ConversationSession } from "../../src/lib/registry/ui/voice-session/session.js";
import type {
	ConversationAdapter,
	ConversationConfig,
} from "../../src/lib/registry/ui/voice-session/types.js";

function fake() {
	let events!: ConversationConfig;
	const adapter: ConversationAdapter = {
		connect: vi.fn(async (config) => {
			events = config;
			config.onConnect();
		}),
		disconnect: vi.fn(),
		sendMessage: vi.fn(),
		sendContextualUpdate: vi.fn(),
		setMuted: vi.fn(),
	};
	return {
		adapter,
		get events() {
			return events;
		},
	};
}
const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
};

describe("shared conversation session", () => {
	it("shares one connection and replaces partial transcripts by id", async () => {
		const f = fake(),
			session = new ConversationSession(f.adapter);
		const first = vi.fn(),
			second = vi.fn();
		session.subscribe(first);
		session.subscribe(second);
		await Promise.all([session.connect(), session.connect()]);
		expect(f.adapter.connect).toHaveBeenCalledTimes(1);
		f.events.onMessage({ id: "turn", source: "ai", message: "hel", final: false });
		f.events.onMessage({ id: "turn", source: "ai", message: "hello", final: true });
		expect(session.snapshot.messages).toEqual([
			{ id: "turn", source: "ai", message: "hello", final: true },
		]);
		expect(first.mock.lastCall?.[0]).toBe(second.mock.lastCall?.[0]);
	});
	it("reconciles SDK echoes with a pending typed user turn", async () => {
		const f = fake(),
			session = new ConversationSession(f.adapter);
		await session.sendMessage("hello");
		f.events.onMessage({ id: "provider-1", source: "user", message: "hello" });
		expect(session.snapshot.messages).toHaveLength(1);
		await session.sendMessage("hello");
		f.events.onMessage({ id: "provider-2", source: "user", message: "hello" });
		expect(session.snapshot.messages).toHaveLength(2);
	});
	it("settles cancellation during startup and ignores late callbacks", async () => {
		const f = fake(),
			opening = deferred();
		f.adapter.connect = vi.fn(async (events) => {
			await opening.promise;
			events.onConnect();
			events.onMessage({ source: "ai", message: "late" });
		});
		const session = new ConversationSession(f.adapter),
			connect = session.connect();
		await Promise.resolve();
		await session.disconnect();
		await connect;
		opening.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(session.snapshot.status).toBe("disconnected");
		expect(session.snapshot.messages).toEqual([]);
	});
	it("ignores a previous connection's events after reconnect", async () => {
		const f = fake(),
			session = new ConversationSession(f.adapter);
		await session.connect();
		const old = f.events;
		await session.disconnect();
		await session.connect();
		old.onDisconnect();
		old.onError(new Error("stale"));
		expect(session.snapshot.status).toBe("connected");
		expect(session.snapshot.error).toBeNull();
	});
	it("recovers from an authentication failure", async () => {
		const f = fake();
		f.adapter.connect = vi
			.fn()
			.mockRejectedValueOnce(new Error("unauthorized"))
			.mockResolvedValue(undefined);
		const session = new ConversationSession(f.adapter);
		await expect(session.connect()).rejects.toThrow("unauthorized");
		expect(session.snapshot.status).toBe("disconnected");
		expect(f.adapter.disconnect).toHaveBeenCalledOnce();
		await session.connect();
		expect(session.snapshot.status).toBe("connected");
		expect(session.snapshot.error).toBeNull();
	});
	it("reports unsupported features without silently calling the provider", async () => {
		const f = fake();
		Object.assign(f.adapter, { capabilities: { context: false } });
		const session = new ConversationSession(f.adapter);
		await session.connect();
		await expect(session.sendContextualUpdate("page changed")).rejects.toThrow(
			"does not support context"
		);
		expect(f.adapter.sendContextualUpdate).not.toHaveBeenCalled();
	});
	it("retains operation failures and rolls back failed typed input", async () => {
		const f = fake();
		f.adapter.sendMessage = vi.fn(() => {
			throw new Error("socket closed");
		});
		const session = new ConversationSession(f.adapter);
		await expect(session.sendMessage("hello")).rejects.toThrow("socket closed");
		expect(session.snapshot.messages).toEqual([]);
		expect(session.snapshot.error?.message).toBe("socket closed");
	});
	it("clamps levels, shares mute state, and clears levels after ending", async () => {
		const f = fake(),
			session = new ConversationSession(f.adapter);
		await session.connect();
		f.events.onAudioLevels?.({ input: 2, output: NaN });
		expect(session.getInputVolume()).toBe(1);
		expect(session.getOutputVolume()).toBe(0);
		await session.setMuted(true);
		expect(session.getInputVolume()).toBe(0);
		expect(session.snapshot.muted).toBe(true);
		await session.disconnect();
		expect(session.snapshot.muted).toBe(false);
		expect(session.snapshot.inputLevel).toBe(0);
	});
	it("cannot fabricate a session when no adapter is supplied", async () => {
		const session = new ConversationSession();
		await expect(session.connect()).rejects.toThrow("Provide a conversation adapter");
		expect(session.snapshot.status).toBe("disconnected");
	});
	it("prevents reuse after disposal", async () => {
		const f = fake(),
			session = new ConversationSession(f.adapter);
		await session.dispose();
		await expect(session.connect()).rejects.toThrow("disposed");
	});
	it("ignores mute completion from a connection that has already ended", async () => {
		const f = fake(),
			pending = deferred();
		f.adapter.setMuted = () => pending.promise;
		const session = new ConversationSession(f.adapter);
		await session.connect();
		const muting = session.setMuted(true);
		await session.disconnect();
		await session.connect();
		pending.resolve();
		await muting;
		expect(session.snapshot.muted).toBe(false);
	});
});
