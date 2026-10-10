# Verification

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

Unit/integration tests cover ancestry isolation, context limits, graph validation, immutable Highlight anchors, synthesis source selection, SQLite reopen, and Ollama stream/error/cancellation paths with a local mock server. ChatGPT tests cover effective-message transmission, split SSE, usage, terminal errors, cancellation, signed identity validation, state rejection, encrypted credential reopening, refresh serialisation and registration retention on sign-out. They use mocked OpenAI endpoints and do not establish live ChatGPT eligibility or live model quality.

Playwright starts the browser preview and exercises selection, branching, persistence, source navigation and synthesis editing. Desktop smoke tests use Playwright's Electron launcher against a production build to check the isolated preload and SQLite-backed data. Browser binaries are development tooling, not runtime app dependencies.

For a manual desktop check, run `npm run dev`: create a Board, ask a question, highlight formatted response text, create two branches, click an Edge label, drag a Note, close/reopen the app, then consolidate selected Notes and follow a source link. Use a locally installed Ollama model to verify real inference and cancellation separately from demo/mocked tests.

Changes to response rendering must retain the exact rendered text snapshot or introduce explicit anchor migration; test repeated passage selection and selection across inline formatting. Changes to providers must not use tests that silently incur paid inference.

## Initial validation — 10 October 2026

On macOS arm64 with Node 24, typechecking, production build and 15 domain/persistence/provider tests passed. Four browser scenarios verified the complete branching/synthesis cycle, selection across inline formatting, exact offsets for a repeated passage, and manual placement after reopening. A production Electron smoke test verified the isolated preload, SQLite saving and reopening.

A separate live Ollama adapter smoke test with the installed `qwen3:1.7b` model received 23 content chunks and input/output usage metadata. This confirms protocol integration, not explanation quality or research outcomes. Tests use isolated temporary desktop data directories and leave existing user Boards untouched.
