import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioRecorder } from "../../src/lib/registry/ui/voice-session/recording.js";

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
