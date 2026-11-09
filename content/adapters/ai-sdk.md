---
title: AI SDK
description: Use any compatible AI SDK provider for transcription, voice forms, and navigation.
---

```bash
npx shadcn-svelte@latest add https://sv11.ui.twango.dev/r/adapter-ai-sdk.json
```

This optional integration provides server-side task factories. It does not provide a realtime conversation transport. Keep the `.server.ts` helper on your backend and use the lightweight HTTP helpers in browser components.

## Transcribe recorded audio

```ts
// Your application's src/routes/api/transcribe/+server.ts
import { createAiSdkTranscriber } from "$lib/components/ui/voice-session/adapters/ai-sdk.server";
import { elevenLabs } from "@ai-sdk/elevenlabs";

const transcribe = createAiSdkTranscriber(elevenLabs.transcription("scribe_v2"));

export async function POST({ request }: { request: Request }) {
	// Apply your application's authentication here.
	const data = await request.formData();
	const audio = data.get("audio");
	if (!(audio instanceof Blob)) return new Response("Missing audio", { status: 400 });
	return Response.json({ text: await transcribe(audio, request.signal) });
}
```

Install the chosen AI SDK provider separately and configure its server-side credentials. Replace the model with any compatible transcription provider without changing the UI.

```svelte
<script lang="ts">
	import Transcriber01 from "$lib/components/blocks/transcriber-01";
	import { createHttpTranscriber } from "$lib/components/ui/voice-session";
	const transcribe = createHttpTranscriber({ endpoint: "/api/transcribe" });
</script>

<Transcriber01 {transcribe} />
```

## Extract form fields

`createAiSdkExtractor` accepts a language model and a schema. The result is validated by AI SDK before returning. Install `zod` if using the schema below.

```ts
import { z } from "zod";
import { createAiSdkExtractor } from "$lib/components/ui/voice-session/adapters/ai-sdk.server";
import type { LanguageModel } from "ai";

export function nameExtractor(model: LanguageModel) {
	return createAiSdkExtractor<{ firstName: string; lastName: string }>({
		model,
		schema: z.object({ firstName: z.string().optional(), lastName: z.string().optional() }),
	});
}
```

Your endpoint accepts `{ transcript }`, calls the extractor with the request's abort signal, and returns `{ fields }`. The browser then composes the tasks:

```svelte
<script lang="ts">
	import VoiceForm01 from "$lib/components/blocks/voice-form-01";
	import { createHttpTranscriber, createHttpExtractor } from "$lib/components/ui/voice-session";
	const transcribe = createHttpTranscriber({ endpoint: "/api/transcribe" });
	const extractFields = createHttpExtractor<{ firstName: string; lastName: string }>({
		endpoint: "/api/fields",
	});
</script>

<VoiceForm01 {transcribe} {extractFields} />
```

Only fields returned by the extractor replace existing form values. Recording and extraction errors are displayed, and requests are aborted when the block is destroyed.

## Semantic navigation

Give `VoiceNav01` the same `transcribe` function and an async `resolve(transcript, destinations, signal)` callback. On the server, use an extractor with a URL schema and the allowed destinations in its system prompt. Check the resulting URL against that destination list before returning it. The component also refuses non-HTTP URLs.

The documentation site uses static hosting; backend endpoints belong in the application consuming these registry items. See [AI SDK transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription) and [structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data). Streaming STT and realtime support in AI SDK are experimental; use the ElevenLabs Scribe adapter or your own streaming bridge for `SpeechInput` and `RealtimeTranscriber01`.
