---
title: llms.txt
description: Machine-readable documentation for LLMs and AI coding tools.
---

sv11-ui publishes its documentation in formats that large language models and AI
coding tools can consume directly, so assistants like Claude, ChatGPT, Cursor,
and v0 can answer questions and generate code with accurate, up-to-date context.

## llms.txt

The [`/llms.txt`](/llms.txt) file is an index of the entire documentation,
following the [llmstxt.org](https://llmstxt.org) convention. It lists every page
grouped by section, with links to the clean Markdown version of each.

```text
https://sv11.ui.twango.dev/llms.txt
```

## llms-full.txt

The [`/llms-full.txt`](/llms-full.txt) file inlines the full text of every
documentation page into a single file — useful for dropping the whole corpus
into a model's context window in one shot.

```text
https://sv11.ui.twango.dev/llms-full.txt
```

## Markdown twins

Every documentation page has a plain-Markdown twin: append `.md` to any docs URL.

```text
https://sv11.ui.twango.dev/docs/components/orb        # HTML page
https://sv11.ui.twango.dev/docs/components/orb.md     # Markdown twin
```

The twins expand the interactive examples into real `svelte` code fences and
render the component API as a Markdown table, so a model sees usable source
rather than rendered widgets.

## Copy Page

Each documentation page has a **Copy Page** button in its header. It copies the
page's Markdown to your clipboard, and its dropdown offers **View as Markdown**,
**Open in ChatGPT**, and **Open in Claude** — each pre-loaded with the page so
you can start asking questions immediately.
