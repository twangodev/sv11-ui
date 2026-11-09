import { describe, expect, it } from "vitest";
import { MockLanguageModelV4, MockTranscriptionModelV4 } from "ai/test";
import { z } from "zod";
import {
	createAiSdkExtractor,
	createAiSdkTranscriber,
} from "../../src/lib/registry/ui/voice-session/adapters/ai-sdk.server.js";

describe("AI SDK task factories", () => {
	it("transcribes the actual Blob bytes with the selected provider model", async () => {
		let received: unknown;
		const model = new MockTranscriptionModelV4({
			doGenerate: async (options) => {
				received = options.audio;
				return {
					text: "Grace Hopper",
					segments: [],
					language: "en",
					durationInSeconds: 1,
					warnings: [],
					response: { timestamp: new Date(), modelId: "test", headers: {} },
				};
			},
		});
		const transcribe = createAiSdkTranscriber(model);
		expect(await transcribe(new Blob([new Uint8Array([1, 2, 3])]))).toBe("Grace Hopper");
		expect(received).toBeDefined();
	});
	function model(text: string) {
		return new MockLanguageModelV4({
			doGenerate: {
				content: [{ type: "text", text }],
				finishReason: { unified: "stop", raw: "stop" },
				usage: {
					inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
					outputTokens: { total: 1, text: 1, reasoning: 0 },
				},
				warnings: [],
			},
		});
	}
	it("returns only schema-validated partial fields", async () => {
		const extract = createAiSdkExtractor<{ firstName: string; lastName: string }>({
			model: model('{"firstName":"Grace"}'),
			schema: z.object({ firstName: z.string().optional(), lastName: z.string().optional() }),
		});
		expect(await extract("My first name is Grace")).toEqual({ firstName: "Grace" });
	});
	it("rejects model output that violates the requested schema", async () => {
		const extract = createAiSdkExtractor<{ firstName: string }>({
			model: model('{"firstName":42}'),
			schema: z.object({ firstName: z.string() }),
		});
		await expect(extract("hello")).rejects.toThrow();
	});
});
