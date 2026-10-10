# Delivery scope

## Implemented prototype

- Phase 1: sticky Notes, compact semantic zoom, detailed reading panel, contiguous Highlight selection, editable child prompts, Highlight-labelled Edges, collision-aware placement, dragging, pan/zoom and navigation.
- Phase 2: provider interface, synthetic demo and local Ollama adapter, streaming/cancellation, ancestry-only effective context snapshots, SQLite persistence, metadata, immutable response records, error reporting and context/depth guidance.
- Phase 3: whole-Board/ancestral-branch/selected-Note synthesis, verbatim learning journeys, provider-driven explanations and structured artefacts, Markdown editing/preview, source links and revision history.
- ChatGPT support: local-app OAuth registration/sign-in, separate saved accounts/workspaces, OS-encrypted credentials, refresh/sign-out, account model discovery and completion-checked Responses streaming. Automated validation uses mocks; live eligibility/inference remains to be checked with an authorised account.
- Early refinement: JSON import/export, editable Takeaways, model discovery, provider overrides through next-Note settings, keyboard-accessible controls and reduced-motion styling.

## Remaining work

- Broaden live model/hardware validation; tune model-specific budgets and exact token accounting. The initial adapter smoke test streamed a response from locally installed `qwen3:1.7b`.
- Separately billed hosted providers and MLX-compatible adapters; explicit independent billing/authentication. Broaden live ChatGPT validation, model-specific budget information and account diagnostics.
- Rich-text editor, configurable summary density and semantic zoom refinements.
- Response regeneration/version UI with version-aware source navigation; existing source responses are currently immutable.
- User-reviewed continuation roots, large-Board performance profiling and fuller keyboard/screen-reader navigation.
- Installer packaging, signing, platform release automation, normalised storage migrations and data recovery tooling.
- Research evaluation requires a separate study design; no learning benefit is claimed from this prototype.
