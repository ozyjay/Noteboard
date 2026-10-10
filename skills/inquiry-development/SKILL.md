---
name: inquiry-development
description: Implement and review Noteboard features involving spatial Notes, Highlight provenance, ancestral context, local inference or synthesis. Use for work in this repository, not generic AI application development.
---

# Noteboard development

Read [AGENTS.md](../../AGENTS.md) for project invariants and [architecture](../../docs/architecture.md) for the implementation boundaries. Consult [decisions](../../docs/decisions.md) when choosing interaction or storage behaviour.

Map the feature to its source records before editing the UI. Branches preserve exact source text, offsets and response version. Rendered-text offsets need the exact rendered surface; Markdown offsets cannot be applied directly to formatted DOM. Repeated occurrences must remain distinguishable.

Context changes must preserve chronological prompts and responses along the single ancestral path. Persist the complete effective request, including system and Highlight messages. Check budget before inference; report limits without removing history. A depth reminder is never a budget override.

Provider changes belong behind `Provider` and the preload bridge. Keep the renderer disconnected from provider endpoints. Use cancellation signals and handle partial stream/error paths without creating incomplete Notes. Settings are separate from exported exploration records. Add a hosted paid adapter only when explicitly requested and configured; no inferred billing authorisation.

Synthesis is derived from user-selected sources. Preserve each source version and document revision; source links reopen the appropriate Note. Learning journeys retain original responses without inference. Synthetic demo output must be labelled and cannot establish factual accuracy.

Use [testing](../../docs/testing.md) for the relevant checks. For anchors, test repeated text and formatting; for context, test a sibling branch is absent; for persistence, close/reopen SQLite; for provider streams, test completion, interruption and cancellation. Review the actual rendered reading and canvas workflow for interaction changes.
