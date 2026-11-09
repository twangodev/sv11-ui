---
title: Adapters
description: Recipes for wiring common voice and transcription providers into sv11 components.
---

sv11's voice and conversation components accept adapter objects that bridge a backend to a provider-agnostic interface. Optional registry entries provide working SDK bridges. Install only the integration your application uses.

[Providers](/docs/providers) explains the shared contracts and session ownership and links to the canonical type definitions. The recipes below assume you have read that reference.

## Recipes

- [ElevenLabs](/docs/adapters/elevenlabs) — managed conversations and Scribe realtime transcription
- [Pipecat](/docs/adapters/pipecat) — RTVI-compatible backends and your chosen transport
- [LiveKit](/docs/adapters/livekit) — LiveKit Agents rooms and transcription streams
- [AI SDK](/docs/adapters/ai-sdk) — model-independent backend transcription and structured extraction
- [Custom](/docs/adapters/custom) — implement the same contracts for your own backend

An adapter is just any object that matches the published interface, so you can wrap any SDK, HTTP endpoint, or WebSocket protocol the same way.
