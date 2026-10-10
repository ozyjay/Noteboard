# Development

Use Node 24+ and npm. Python is only needed for optional skill validation; use active pyenv `python3`.

```sh
npm ci
npx install-electron --no
npm run dev
```

Development bundles Electron main/preload with esbuild, starts Vite on loopback port 5173 and launches Electron. React hot reloads; restart the command after changing main/preload code. Production builds run TypeScript checking, Vite and esbuild. `npm start` requires a completed build.

`npm run format` applies the repository formatting; `npm run format:check` verifies it. GitHub Actions runs formatting, typechecking, build, domain tests and browser/desktop smoke tests. Electron 44 downloads its binary on first use; the explicit install command prepares it in advance.

## Local Ollama

Install/start Ollama independently, and pull a model appropriate to your machine. In Noteboard provider settings, select Ollama, retain the loopback server address, choose **Discover**, and select an installed model. Set a context budget within the model's maximum. The adapter sends complete context and a 1,024-token output cap.

No model downloads, live inference requests, paid API setup or subscription authorisation happen automatically.

## ChatGPT account support

The desktop app implements the documented [local-app ChatGPT plan usage flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), using dynamic public-client registration, PKCE, a loopback callback and RS256 ID-token validation. It requires an eligible ChatGPT account and explicit plan-use consent; availability remains subject to OpenAI’s preview restrictions.

Choose ChatGPT in provider settings, add an account or workspace with **Continue with ChatGPT**, then **Discover** and choose a model. Saved accounts can be selected independently; signing out retains the issued registration for later sign-in. **Manage usage** opens ChatGPT’s usage settings. The app never uses `OPENAI_API_KEY`, existing Codex credentials, or a separately billed API fallback.

Credentials are encrypted with Electron `safeStorage`, written atomically with owner-only permissions to `chatgpt-credentials.bin` in the app’s user-data directory, and excluded from SQLite, renderer state and Board exports. Platforms without secure credential storage are refused, including Linux’s plaintext fallback. Refreshes are serialised within the process. A single-instance lock prevents concurrent desktop processes from racing credential rotation.

ChatGPT inference uses account-specific model discovery and `POST /v1/responses` with `store: false`, `stream: true` and complete effective messages. System instructions become developer messages before both transmission and provenance recording. The local context estimate includes a 1,024-token reserve; this preview does not support an output cap or exact model-budget discovery, so the service may still reject a request or generate a longer response. No context is automatically reduced.

Automated tests mock authentication and inference and do not establish live account eligibility or model quality. To validate live support, sign in explicitly, create a Note and a Highlight branch, cancel a generation, consolidate selected Notes, and reopen the app. Review actual plan usage in ChatGPT settings.

## Data and failures

Desktop Boards and settings live in `inquiry.sqlite` under the existing Electron user-data directory. Noteboard retains the original Inquiry storage location so renaming the app keeps saved Boards and provider settings available. Export a JSON Board for a portable copy. Import gives it a new Board identity and preserves internal provenance. Browser preview data is isolated in localStorage and is not automatically transferred to desktop; use export/import.

Generation errors retain the entered question for retry. Cancellation creates no partial Note or artefact. Persistence errors appear in the workspace; export the Board if saving fails. Only one generation runs at a time; changing Boards/provider settings is disabled during inference.

See [testing](testing.md) for validation commands and [roadmap](roadmap.md) for remaining scope.
