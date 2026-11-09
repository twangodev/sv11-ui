import { describe, expect, it, vi } from "vitest";
import {
	composeTimedWords,
	findWordIndex,
} from "../../src/lib/registry/ui/transcript-viewer/utils.js";
import {
	createHttpExtractor,
	createHttpTranscriber,
} from "../../src/lib/registry/ui/voice-session/http.js";

describe("provider-neutral word timing", () => {
	it("keeps native timestamp precision and inserts untimed whitespace", () => {
		const timings = [
			{ text: "hello", startTime: 0.123, endTime: 0.456 },
			{ text: "world", startTime: 1.234, endTime: 2.345 },
		];
		const composed = composeTimedWords(timings);
		expect(composed.words[0].startTime).toBe(0.123);
		expect(composed.segments[1]).toMatchObject({ kind: "gap", text: " " });
		expect(findWordIndex(composed.words, 0.3)).toBe(0);
		expect(findWordIndex(composed.words, 0.9)).toBe(-1);
		expect(findWordIndex(composed.words, 1.5)).toBe(1);
	});
	it("rejects invalid or unordered timestamps", () => {
		expect(() => composeTimedWords([{ text: "bad", startTime: NaN, endTime: 1 }])).toThrow(
			"finite"
		);
		expect(() => composeTimedWords([{ text: "bad", startTime: 2, endTime: 1 }])).toThrow("ranges");
	});
});
describe("HTTP task adapters", () => {
	it("sends a recorded Blob and preserves the cancellation signal", async () => {
		const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ text: "hello" })),
			signal = new AbortController().signal;
		const transcribe = createHttpTranscriber({ endpoint: "/transcribe", fetch: request });
		expect(await transcribe(new Blob(["audio"]), signal)).toBe("hello");
		expect(request.mock.calls[0][1]?.signal).toBe(signal);
		expect(request.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
	});
	it("rejects invalid backend data and HTTP failures", async () => {
		const request = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(Response.json({ fields: [] }))
			.mockResolvedValueOnce(new Response("", { status: 403 }));
		const extract = createHttpExtractor({ endpoint: "/fields", fetch: request });
		await expect(extract("hello")).rejects.toThrow("fields: object");
		await expect(extract("hello")).rejects.toThrow("403");
	});
});
