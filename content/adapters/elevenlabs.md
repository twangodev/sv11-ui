---
title: ElevenLabs
description: Wrap the @elevenlabs/client SDK in a ConversationAdapter.
---

> **TODO:** Recipe content pending.

This recipe will show how to wrap [`@elevenlabs/client`](https://www.npmjs.com/package/@elevenlabs/client) in a [`ConversationAdapter`](/docs/providers) so that ElevenLabs Agents plug into [ConversationBar](/docs/components/conversation-bar) without modifying any svagent code.

Planned content:

- Installing `@elevenlabs/client`
- A factory function that maps ElevenLabs session events to the `ConversationConfig` callbacks (`onConnect`, `onDisconnect`, `onMessage`, `onError`, `onStatusChange`, `onModeChange`)
- Public vs private agent auth (signed URLs vs bare `agentId`)
- Usage with `<ConversationBar {adapter} />`

Until this page is filled in, see [Providers](/docs/providers) for the interface definitions and [Custom](/docs/adapters/custom) for the general pattern.
