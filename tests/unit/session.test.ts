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
	it("preserves distinct spoken turns with the same text as local input", async () => {
		const f = fake(),
			session = new ConversationSession(f.adapter),
			messages = vi.fn();
		session.subscribeMessages(messages);
		await session.sendMessage("yes");
		expect(messages).not.toHaveBeenCalled();
		f.events.onMessage({ id: "spoken", source: "user", message: "yes" });
		expect(session.snapshot.messages).toHaveLength(2);
		expect(messages).toHaveBeenCalledOnce();
	});
	it("lets adapters correlate typed turns and echoes by stable ID", async () => {
		const f = fake(),
			session = new ConversationSession(f.adapter);
		Object.assign(f.adapter, { textMessageOwner: "adapter" });
		f.adapter.sendMessage = async (message) => {
			f.events.onMessage({ id: "typed", source: "user", message });
		};
		await session.sendMessage("hello");
		f.events.onMessage({ id: "typed", source: "user", message: "hello", final: true });
		expect(session.snapshot.messages).toHaveLength(1);
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
		const rejected = expect(connect).rejects.toMatchObject({ name: "AbortError" });
		await session.disconnect();
		await rejected;
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
	it("retains operation failures without adding failed typed input", async () => {
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
	it("cleans up remote closure before reconnecting and resets device and mute state", async () => {
		const f = fake(),
			teardown = deferred(),
			session = new ConversationSession(f.adapter);
		f.adapter.setInputDevice = vi.fn();
		await expect(session.setInputDevice("early")).rejects.toThrow("Connect before");
		await session.connect();
		await session.setMuted(true);
		await session.setInputDevice("mic");
		f.adapter.disconnect = vi.fn(() => teardown.promise);
		f.events.onDisconnect();
		const reconnect = session.connect();
		expect(session.snapshot.muted).toBe(false);
		expect(session.snapshot.inputDeviceId).toBeUndefined();
		expect(f.adapter.connect).toHaveBeenCalledOnce();
		teardown.resolve();
		await reconnect;
		expect(f.adapter.connect).toHaveBeenCalledTimes(2);
	});
	it("honors a later disconnect while reconnect is waiting for teardown", async () => {
		const f = fake(),
			teardown = deferred(),
			session = new ConversationSession(f.adapter);
		await session.connect();
		f.adapter.disconnect = () => teardown.promise;
		const ending = session.disconnect();
		const reconnect = session.connect();
		const rejected = expect(reconnect).rejects.toMatchObject({ name: "AbortError" });
		void session.disconnect();
		teardown.resolve();
		await ending;
		await rejected;
		expect(session.snapshot.status).toBe("disconnected");
		expect(f.adapter.connect).toHaveBeenCalledOnce();
	});
	it("rejects cancelled sends without adding a turn to the next connection", async () => {
		const f = fake(),
			pending = deferred(),
			session = new ConversationSession(f.adapter);
		f.adapter.sendMessage = vi.fn(() => pending.promise);
		await session.connect();
		const sending = session.sendMessage("late");
		await vi.waitFor(() => expect(f.adapter.sendMessage).toHaveBeenCalledOnce());
		const rejected = expect(sending).rejects.toMatchObject({ name: "AbortError" });
		await session.disconnect();
		await session.connect();
		pending.resolve();
		await rejected;
		expect(session.snapshot.messages).toEqual([]);
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
		const rejected = expect(muting).rejects.toMatchObject({ name: "AbortError" });
		await session.disconnect();
		await session.connect();
		pending.resolve();
		await rejected;
		expect(session.snapshot.muted).toBe(false);
	});
});
