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

No model downloads, live inference requests, paid API setup or subscription authorisation happen automatically. This app does not implement Sign in with ChatGPT.

## Data and failures

Desktop Boards and settings live in `inquiry.sqlite` under the existing Electron user-data directory. Noteboard retains the original Inquiry storage location so renaming the app keeps saved Boards and provider settings available. Export a JSON Board for a portable copy. Import gives it a new Board identity and preserves internal provenance. Browser preview data is isolated in localStorage and is not automatically transferred to desktop; use export/import.

Generation errors retain the entered question for retry. Cancellation creates no partial Note or artefact. Persistence errors appear in the workspace; export the Board if saving fails. Only one generation runs at a time; changing Boards/provider settings is disabled during inference.

See [testing](testing.md) for validation commands and [roadmap](roadmap.md) for remaining scope.
