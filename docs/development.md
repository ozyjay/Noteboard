# Development

Use Node 24+, npm and PowerShell (`pwsh`) for terminal commands and script examples. Python is only needed for optional skill validation; use active pyenv `python3`.

```powershell
npm ci
npx install-electron --no
npm run dev
```

Development bundles Electron main/preload with esbuild, starts Vite on loopback port 5173 and launches Electron. React hot reloads; restart the command after changing main/preload code. Production builds run TypeScript checking, Vite and esbuild. `npm start` requires a completed build.

`npm run format` applies the repository formatting; `npm run format:check` verifies it. GitHub Actions runs formatting, typechecking, build, domain tests and browser/desktop smoke tests. Electron 44 downloads its binary on first use; the explicit install command prepares it in advance.

## Local macOS installation

Run these commands in PowerShell from the repository root:

```powershell
npm run install:macos
open (Join-Path $HOME 'Applications/Noteboard.app')
```

This builds a standalone app at `release/Noteboard.app`, signs it locally with an ad hoc signature and copies it into `~/Applications`. The installed app runs without the repository, Node or a development server. It uses the existing Inquiry desktop data directory, preserving Boards and provider settings. This local build has no Developer ID signing or notarisation for distribution.

`npm run package:macos` builds without installing. Installation refuses to overwrite an existing bundle. To reinstall or update, quit Noteboard, then run:

```powershell
pwsh -NoProfile -File ./scripts/reinstall-macos.ps1
# Alternatively:
npm run reinstall:macos
```

The reinstall script builds before replacing `~/Applications/Noteboard.app`, verifies the installed signature and opens the app. It also works for a first installation. Saved Boards, settings and credentials are stored separately and are retained.

## Appearance

Open **Appearance settings** in the sidebar to choose Light, Dark or Follow system, accent colour, reading text size and grid visibility. Note style offers Classic (the default) or Sticky notes, with paper colours, adhesive strips, folded corners and deeper shadows on the canvas, plus a subtle matching tint in the reader. Both styles support light and dark themes. Interface fonts offer Standard or Monospace; reading fonts offer Sans-serif, Serif or Monospace. Monospace uses Consolas when installed, then Menlo, Monaco or the system monospace font. Changes preview immediately; Save retains them across Boards and restarts, Cancel restores saved preferences, and Reset defaults restores the original appearance.

Drag the left edge of the detailed Note reader to resize it. With the divider focused, Left/Right arrows adjust the width, Shift makes larger adjustments, and Home/End select the narrowest/widest size. Expanding and collapsing a Note retains its side-panel width while it is open. Resizing leaves space for the canvas and adapts to the window size.

## Local Ollama

Install/start Ollama independently, and pull a model appropriate to your machine. In Noteboard provider settings, select Ollama, retain the loopback server address, choose **Discover**, and select an installed model. Set a context budget within the model's maximum. The adapter sends complete context and a 1,024-token output cap.

No model downloads, live inference requests, paid API setup or subscription authorisation happen automatically.

## ChatGPT account support

The desktop app implements the documented [local-app ChatGPT plan usage flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), using dynamic public-client registration, PKCE, a loopback callback and RS256 ID-token validation. It requires an eligible ChatGPT account and explicit plan-use consent; availability remains subject to OpenAI’s preview restrictions.

Choose ChatGPT in provider settings, add an account or workspace with **Continue with ChatGPT**, then **Discover** and choose a model. Saved accounts can be selected independently; signing out retains the issued registration for later sign-in. **Manage usage** opens ChatGPT’s usage settings. The app never uses `OPENAI_API_KEY`, existing Codex credentials, or a separately billed API fallback.

The model dropdown shows the account’s available model names. **Thinking effort** offers Model default and explicit levels from None to Maximum. Support varies by model; if ChatGPT rejects a level, select Model default or another supported level and retry. Higher effort can increase latency and plan usage. Changing provider, account or model resets the override. Generated Notes and synthesis preserve explicit effort metadata; historical and imported responses remain unchanged. See the [official reasoning guide](https://developers.openai.com/api/docs/guides/reasoning).

In a Note prompt, press **Enter** to send or **Shift+Enter** to add a line. Empty questions and IME composition do not submit.

While a Note or synthesis is generating, a progress indicator appears with **Cancel generation**. Partial response text is not shown; the formatted result opens after generation completes successfully.

New Notes ask the selected model to answer naturally, lead with the useful conclusion and include broader context only when helpful. **Where this fits** is optional, and answers do not need a concluding **Takeaway**. The canvas uses an explicit Takeaway if present or a short extract from the first substantive paragraph; you can edit it independently. Follow-ups retain their selected passage and ancestral conversation. Existing and imported responses stay as originally recorded.

In **Provider settings**, edit **Custom instructions** to personalise future Notes and generated synthesis. Defaults cover response style, Australian English, accuracy, uncertainty, sources and recommendations. **Save settings** commits the draft; **Cancel** or closing the dialog discards it. **Restore response preferences** restores the default draft. Clearing the field keeps only basic Noteboard guidance. These settings apply across providers; scripted demo responses do not follow them. The app has no browsing tools or connection to ChatGPT projects or personalisation. Instructions actually used are recorded in generation context and included in Board exports; changing settings never rewrites earlier responses.

Credentials are encrypted with Electron `safeStorage`, written atomically with owner-only permissions to `chatgpt-credentials.bin` in the app’s user-data directory, and excluded from SQLite, renderer state and Board exports. Platforms without secure credential storage are refused, including Linux’s plaintext fallback. Refreshes are serialised within the process. A single-instance lock prevents concurrent desktop processes from racing credential rotation.

ChatGPT inference uses account-specific model discovery and `POST /v1/responses` with `store: false`, `stream: true` and complete effective messages. System instructions become developer messages before both transmission and provenance recording. The local context estimate includes a 1,024-token reserve; this preview does not support an output cap or exact model-budget discovery, so the service may still reject a request or generate a longer response. No context is automatically reduced.

Automated tests mock authentication and inference and do not establish live account eligibility or model quality. To validate live support, sign in explicitly, create a Note and a Highlight branch, cancel a generation, consolidate selected Notes, and reopen the app. Review actual plan usage in ChatGPT settings.

## Data and failures

On macOS, Noteboard disables Force Click lookup through an app-local preference so pressing firmly on the canvas does not invoke Dictionary. Ordinary clicking, dragging and Highlight selection remain available. Physical trackpad behaviour needs a manual check after installing and restarting the desktop app.

Production builds use [Rolldown chunk groups](https://rolldown.rs/reference/OutputOptions.codeSplitting) in `vite.config.ts` to separate React, canvas, KaTeX maths and remaining vendor code from the app. The standard 500 kB warning limit remains enabled. These are static chunks loaded together, improving cache separation without deferring the reader or changing Highlight timing; total startup code is broadly unchanged. All scripts, styles and maths fonts remain bundled for offline desktop use.

Use the bin icon in the Board toolbar to **Delete Board**, or open a Note and use its bin icon to **Delete Note**. Both actions require confirmation and cannot be undone. Note deletion includes every descendant; the confirmation shows the total count. Existing synthesis keeps read-only copies of deleted source Notes, available through source links. Board deletion removes its Notes and synthesis documents. Deleting the last Board opens a fresh empty Board.

Desktop Boards and settings live in `inquiry.sqlite` under the existing Electron user-data directory. Noteboard retains the original Inquiry storage location so renaming the app keeps saved Boards and provider settings available. Export a JSON Board for a portable copy. Import gives it a new Board identity and preserves internal provenance. Browser preview data is isolated in localStorage and is not automatically transferred to desktop; use export/import.

Generation errors retain the entered question for retry. Cancellation creates no partial Note or artefact. Persistence errors appear in the workspace; export the Board if saving fails. Only one generation runs at a time; changing Boards/provider settings is disabled during inference.

See [testing](testing.md) for validation commands and [roadmap](roadmap.md) for remaining scope.

See [ChatGPT conversation import](chatgpt-import.md) for importing a text conversation as a Note chain and adding retrospective Highlights.
