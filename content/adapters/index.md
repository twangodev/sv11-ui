---
title: Adapters
description: Recipes for wiring common voice and transcription providers into svagent components.
---

svagent's voice and conversation components accept adapter objects that bridge a specific backend to a provider-agnostic interface. This section will collect recipes for implementing those adapters against common SDKs.

The interface definitions themselves live on the [Providers](/docs/providers) page — the recipes here assume you have already read that reference.

## Recipes

- [ElevenLabs](/docs/adapters/elevenlabs) — **TODO**
- [Custom](/docs/adapters/custom) — **TODO**

OpenAI and Deepgram recipes are planned.

An adapter is just any object that matches the published interface, so you can wrap any SDK, HTTP endpoint, or WebSocket protocol the same way.
