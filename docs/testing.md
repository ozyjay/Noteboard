# Verification

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
```

Unit/integration tests cover ancestry isolation, context limits, graph validation, immutable Highlight anchors, synthesis source selection, SQLite reopen, and Ollama stream/error/cancellation paths with a local mock server. ChatGPT tests cover effective-message transmission, split SSE, usage, terminal errors, cancellation, signed identity validation, state rejection, encrypted credential reopening, refresh serialisation and registration retention on sign-out. They use mocked OpenAI endpoints and do not establish live ChatGPT eligibility or live model quality.

Custom-instruction checks cover older settings defaults, explicitly blank values, length validation, SQLite reopening, exact instruction inclusion in exploration/synthesis context and budget checks without altering ancestry or prior versions. Browser checks exercise Save, Cancel, Restore, reopening and recorded future contexts using scripted demo responses. These verify request construction and persistence, not live response style or parity with ChatGPT.

Playwright starts the browser preview and exercises selection, branching, persistence, source navigation and synthesis editing. Desktop smoke tests use Playwright's Electron launcher against a production build to check the isolated preload and SQLite-backed data. Browser binaries are development tooling, not runtime app dependencies.

Revision checks cover revised prompt/response history, immutable originals, exact ancestry across parent revisions, imported chronological sources, human-edit labelling, validation of revision bases/ancestor versions, version 2 migration, SQLite reopening and unchanged synthesis references. Browser checks exercise prompt regeneration, same-prompt regeneration, model overrides, failure/cancellation with retained drafts, manual Markdown/maths edits, branching from the viewed revision and navigation to older Highlight/synthesis sources after reopening. Demo and mocked provider results establish request/provenance behaviour, not live inference quality.

Self-review checks cover the exact viewed answer, preserved generated conversation and earlier review turns, edited and imported sources, sibling exclusion, and unchanged original versions. Browser checks verify the editable review prompt, failed and cancelled requests without a saved revision, successful request recording, reopening the improved version and navigating an original Highlight. These use mocked inference and do not establish that a model's review improves factual accuracy.

For a manual desktop check, run `npm run dev`: create a Board, ask a question, highlight formatted response text, create two branches, click an Edge label, drag a Note, close/reopen the app, then consolidate selected Notes and follow a source link. Use a locally installed Ollama model to verify real inference and cancellation separately from demo/mocked tests.

On a Mac with Apple Intelligence enabled, select text in a prompt composer, **Revised prompt**, **Revised response** and synthesis editor, then right-click and use **Writing Tools**. Confirm the replacement remains in the draft, Cancel discards it, and saving a revised response retains its original version and existing Highlight links. Check native Undo/Redo and Cut/Copy/Paste as well. Automated desktop checks do not establish availability or rewrite quality of the macOS service.

Changes to response rendering must retain the exact rendered text snapshot or introduce explicit anchor migration; test repeated passage selection and selection across inline formatting. Changes to providers must not use tests that silently incur paid inference.

Web/file tests use mocked Responses streams to verify the web-search tool and explicit off switch, inline file-data wire payloads, completed call/citation records and unused-search reporting. Domain checks cover filename/base64/size and URL validation, ancestral file retention, review context, unsupported-provider rejection, schema 4 migration and SQLite reopening. Browser checks exercise attachment validation, search controls, citation clicks through the external-link bridge, file inheritance and saved provenance after reopening. Desktop checks reject unsafe link schemes at the main-process boundary. These establish implementation behaviour, not live account/model search or document-processing eligibility. For live validation, explicitly choose ChatGPT, attach a small document, ask a question requiring recent sources, inspect the actual sources, then branch and reopen the Board.

## Initial validation — 10 October 2026

On macOS arm64 with Node 24, typechecking, production build and 15 domain/persistence/provider tests passed. Four browser scenarios verified the complete branching/synthesis cycle, selection across inline formatting, exact offsets for a repeated passage, and manual placement after reopening. A production Electron smoke test verified the isolated preload, SQLite saving and reopening.

A separate live Ollama adapter smoke test with the installed `qwen3:1.7b` model received 23 content chunks and input/output usage metadata. This confirms protocol integration, not explanation quality or research outcomes. Tests use isolated temporary desktop data directories and leave existing user Boards untouched.

Conversation import tests use sanitised synthetic export fixtures. They cover selected paths, unsupported content, limits, version 1 migration, import provenance, retrospective anchors, inherited context and SQLite reopening. Browser/desktop checks verify preview, cancellation, navigation, branching and synthesis without live ChatGPT inference.

Model-discovery browser checks use a mocked desktop bridge to verify automatic ChatGPT catalogue loading, reuse across root/Highlight composers and revisions, explicit refresh, account isolation, late results, visible failure/retry and sign-out/sign-in invalidation. These checks make no live provider requests.
