import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioRecorder } from "../../src/lib/registry/ui/voice-session/recording.js";
import { createWebSpeechAdapter } from "../../src/lib/registry/blocks/realtime-transcriber-01/adapter.js";

afterEach(() => vi.unstubAllGlobals());
describe("microphone ownership", () => {
	it("releases a permission grant that arrives after cancellation", async () => {
		let grant!: (value: unknown) => void;
		const stop = vi.fn();
		vi.stubGlobal("navigator", {
			mediaDevices: { getUserMedia: () => new Promise((resolve) => (grant = resolve)) },
		});
		const recorder = new AudioRecorder(),
			starting = recorder.start();
		recorder.cancel();
		grant({ getTracks: () => [{ stop }] });
		await expect(starting).rejects.toThrow("cancelled");
		expect(stop).toHaveBeenCalledOnce();
	});
	it("stopping before permission is granted also cancels the pending capture", async () => {
		let grant!: (value: unknown) => void;
		const stop = vi.fn();
		vi.stubGlobal("navigator", {
			mediaDevices: { getUserMedia: () => new Promise((resolve) => (grant = resolve)) },
		});
		const recorder = new AudioRecorder(),
			starting = recorder.start();
		await expect(recorder.stop()).rejects.toThrow("not started");
		grant({ getTracks: () => [{ stop }] });
		await expect(starting).rejects.toThrow("cancelled");
		expect(stop).toHaveBeenCalledOnce();
	});
});

describe("recording completion", () => {
	it("shares concurrent stop calls and waits for the final audio chunk", async () => {
		const recordings: NativeRecorder[] = [];
		class NativeRecorder {
			static isTypeSupported() {
				return true;
			}
			state = "inactive";
			mimeType = "audio/webm";
			onstop: (() => void) | null = null;
			ondataavailable: ((event: { data: Blob }) => void) | null = null;
			constructor() {
				recordings.push(this);
			}
			start() {
				this.state = "recording";
			}
			stop = vi.fn(() => {
				this.state = "inactive";
			});
		}
		const release = vi.fn();
		vi.stubGlobal("MediaRecorder", NativeRecorder);
		vi.stubGlobal("navigator", {
			mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: release }] }) },
		});
		const recorder = new AudioRecorder();
		await recorder.start();
		const native = recordings[0];
		const first = recorder.stop(),
			second = recorder.stop();
		expect(second).toBe(first);
		let completed = false;
		void second.then(() => {
			completed = true;
		});
		await Promise.resolve();
		expect(completed).toBe(false);
		native.ondataavailable?.({ data: new Blob(["final audio"]) });
		native.onstop?.();
		expect(await (await first).text()).toBe("final audio");
		expect(native.stop).toHaveBeenCalledOnce();
		expect(release).toHaveBeenCalledOnce();
	});
});

describe("browser transcription completion", () => {
	it("keeps the final result callback alive until recognition ends", async () => {
		const recognitions: NativeRecognition[] = [];
		class NativeRecognition {
			onstart: (() => void) | null = null;
			onresult: ((event: unknown) => void) | null = null;
			onend: (() => void) | null = null;
			constructor() {
				recognitions.push(this);
			}
			start() {
				queueMicrotask(() => this.onstart?.());
			}
			stop = vi.fn();
			abort = vi.fn();
		}
		vi.stubGlobal("window", { SpeechRecognition: NativeRecognition });
		const adapter = createWebSpeechAdapter();
		const committed = vi.fn();
		await adapter.start({ onCommittedTranscript: committed });
		const native = recognitions[0];
		const stopping = adapter.stop();
		let completed = false;
		void Promise.resolve(stopping).then(() => {
			completed = true;
		});
		await Promise.resolve();
		expect(completed).toBe(false);
		native.onresult?.({
			resultIndex: 0,
			results: [{ 0: { transcript: "final phrase" }, isFinal: true }],
		});
		native.onend?.();
		await stopping;
		expect(committed).toHaveBeenCalledWith("final phrase");
		expect(native.abort).not.toHaveBeenCalled();
	});
});
