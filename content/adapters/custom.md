---
title: Custom
description: Build a ConversationAdapter against your own backend.
---

> **TODO:** Recipe content pending.

This recipe will show how to implement a [`ConversationAdapter`](/docs/providers) against a custom backend — for example, a WebSocket protocol, a streaming HTTP endpoint, or an in-process mock.

Planned content:

- Minimal WebSocket skeleton mapping connection lifecycle to `onStatusChange` / `onConnect` / `onDisconnect`
- Wire format for emitting `ConversationMessage` objects through `onMessage`
- Optional `onModeChange` handling for backends that distinguish speaking vs listening
- Patterns for `sendMessage`, `sendContextualUpdate`, and `setMuted`

Until this page is filled in, see [Providers](/docs/providers) for the interface definitions.
