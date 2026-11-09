import type { ExtractFields, TranscribeAudio } from "./types.js";

export interface HttpTaskOptions {
	endpoint: string;
	/** Inject auth headers or a custom fetch implementation here. */
	fetch?: typeof fetch;
}
async function result(response: Response): Promise<unknown> {
	if (!response.ok) throw new Error(`Voice task failed (${response.status}).`);
	return response.json();
}
/** The endpoint accepts multipart `audio` and returns { text: string }. */
export function createHttpTranscriber(options: HttpTaskOptions): TranscribeAudio {
	return async (audio, signal) => {
		const body = new FormData();
		body.set("audio", audio, "recording");
		const value = await result(
			await (options.fetch ?? fetch)(options.endpoint, { method: "POST", body, signal })
		);
		if (!value || typeof value !== "object" || !("text" in value) || typeof value.text !== "string")
			throw new Error("Transcription endpoint must return { text: string }.");
		return value.text;
	};
}
/** The endpoint accepts { transcript } and returns { fields }. Validate fields on the server. */
export function createHttpExtractor<T>(options: HttpTaskOptions): ExtractFields<T> {
	return async (transcript, signal) => {
		const value = await result(
			await (options.fetch ?? fetch)(options.endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ transcript }),
				signal,
			})
		);
		if (
			!value ||
			typeof value !== "object" ||
			!("fields" in value) ||
			!value.fields ||
			typeof value.fields !== "object" ||
			Array.isArray(value.fields)
		)
			throw new Error("Extraction endpoint must return { fields: object }.");
		return value.fields as Partial<T>;
	};
}
