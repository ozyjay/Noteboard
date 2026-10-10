# Architecture

Noteboard separates a React renderer from an Electron main process. The sandboxed preload exposes only Board/settings persistence, model discovery, generation, cancellation and stream subscription. The renderer has no Node access and cannot call arbitrary remote inference endpoints. External navigation and new windows are blocked; narrow main-process actions open only the generated OpenAI authorisation URL and fixed ChatGPT usage settings in the system browser; rendered Markdown does not execute HTML or fetch images.

## Domain records

A `Board` has a schema version, title, timestamps, spatial Notes, directed Edges, document artefacts and a viewport. Zod validates saved/imported records. Additional graph validation rejects cycles, multiple roots, duplicate identifiers, missing sources and invalid Highlight ranges.

Each `Note` preserves its prompt, position, editable Takeaway and immutable response versions. Each version records text, provider, model, timestamp, effective context, token estimate and available usage. An `Edge` owns one Highlight identifying the source Note/version, exact text, offsets and the text surface used for those offsets. A passage may motivate several independent branches.

Selections in formatted Markdown use DOM Range offsets into the complete rendered text snapshot. This avoids guessing Markdown offsets or choosing the first repeated substring. Text surfaces are version-specific. Example Notes use Markdown-surface anchors; the reader locates their passage in the rendered surface when possible and always shows the complete source Highlight separately.

Notes and synthesis share GitHub-flavoured Markdown and local KaTeX rendering. Maths supports `$…$`, `$$…$$`, `\(…\)` and `\[…\]`; alternative delimiters are normalised for display outside code, leaving stored source text unchanged. KaTeX CSS/fonts are bundled locally; trusted TeX commands are disabled. Invalid equations remain visible as source text. A Highlight intersecting a typeset equation expands to the whole equation and records its exact LaTeX in `latexSources`, which is included in the follow-up request. Its `displayText` uses LaTeX for readable labels and learning journeys while its original text and offsets retain the complete rendered snapshot. New anchors identify the maths-enabled rendered surface with `renderedMath`; reopening an older rendered anchor uses the original non-maths renderer to retain its saved offsets and snapshot. No saved anchor is migrated.

## Context and providers

`buildContext` reconstructs root-to-parent ancestry, then appends the selected passage and new user prompt. Sibling Notes are excluded. The request is recorded on the resulting response version. A conservative UTF-8 byte estimate and 1,024-token output reserve provide a preflight budget check, not exact tokenisation. There is no automatic context reduction.

The `Provider` interface declares streaming, model discovery and authentication capabilities. Demo generation is explicitly synthetic. The Ollama adapter runs in the main process and accepts only loopback endpoints. It discovers `/api/tags`, checks model context capability with `/api/show`, and streams `/api/chat` as newline-delimited JSON. Complete records are committed only after the stream's completion marker. Aborting or failing leaves the source Board untouched.

The ChatGPT adapter uses the documented local-app Sign in with ChatGPT public-client flow. A loopback callback validates state, exchanges a PKCE-bound code, verifies the ID-token signature/issuer/audience/expiry/nonce, and keeps issued client IDs bound to verified subjects. Separate saved registrations support different accounts/workspaces. A stable host UUID is reused. Credentials reside in an atomic, OS-encrypted file with owner-only permissions, independent of Board/settings persistence; the preload exposes only account labels, connection state, sign-in/cancel/sign-out and a fixed usage-settings action. No token reaches the renderer. Expiring tokens refresh through a serialised rotation; terminal refresh errors clear tokens while retaining registration. Sign-out attempts remote revocation and reports if only local sign-out succeeded.

ChatGPT model discovery uses the selected account’s token. Inference sends complete role/content pairs to Responses with `store: false` and `stream: true`. System messages are converted to developer messages before recording and transmission, preserving exact effective context. No provider conversation state, tools, automatic truncation or API-key fallback is used. Failed/incomplete/interrupted streams cannot commit a Note or artefact. The local estimate reserves output space but the preview route has no supported output cap; service errors remain authoritative.

## Persistence

Electron stores `inquiry.sqlite` in `app.getPath('userData')`. SQLite uses WAL and two tables: `boards` (validated JSON snapshots with sortable title/update metadata), and separate `settings`. Schema version 1 is the initial storage format. Individual saves are atomic SQLite upserts; the renderer queues snapshots to preserve write order. This favours a straightforward prototype over a prematurely normalised graph schema.

JSON export includes exploration and artefacts, not provider settings. Import validates the tree and anchors and gives the imported Board a new ID. Browser preview uses localStorage and demo inference only, explicitly identified in the interface.

## Synthesis

A learning journey is deterministic and preserves original prompts/responses. Integrated explanations and structured artefacts use the configured provider with user-selected source Notes. Artefacts store source IDs and response version IDs, generated context and a history of generated/edited Markdown document versions. Source links use `inquiry://note/ID` and reopen the Note. The editor supports Markdown plus formatted preview. Returning to Explore or another artefact saves a changed revision in memory and queues local persistence.

## Boundaries

SQLite/network operations remain in Electron; graph, ancestry and selection behaviour are independently testable. No autonomous branching, agent orchestration, shared Boards, paid fallbacks or credentials in Board data are present. ChatGPT protocol: [registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations). Provider protocol documentation: [Ollama chat](https://docs.ollama.com/api/chat), [model listing](https://docs.ollama.com/api/tags). Desktop isolation follows [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation).
