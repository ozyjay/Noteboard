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

The macOS app uses Touch ID protected Keychain storage and requires an Apple signing identity and a matching macOS provisioning profile. In Xcode Settings → Accounts, sign in with the Apple developer account for your signing team. To let Xcode register/provision `app.noteboard.desktop` with Keychain Sharing, run this once from PowerShell using your ten-character team ID:

```powershell
pwsh -NoProfile -File scripts/prepare-macos-signing.ps1 -TeamId 'YOURTEAMID'
```

This builds a disposable signing target under `release/signing-setup`; it is never installed or run. Xcode may need account sign-in or device registration before it can issue a development profile. The team ID is the certificate's organisational unit (`OU`), which can differ from the identifier in its display name. If Xcode reports that this Mac is unregistered, adding `-RegisterDevice` explicitly authorises Xcode to add its identifier to the team's Apple Developer device list. Alternatively, supply an existing macOS profile for this app identifier with its Keychain access group. Keep the same app identifier and signing team for subsequent builds.

Packaging automatically reuses the profile created by that setup command and selects its matching valid local signing identity. Once setup has succeeded, run `npm run install:macos` from any new PowerShell session.

To use a different profile or select an identity when several match, supply `-SigningIdentity` and `-ProvisioningProfile` to either packaging or reinstall script, or set these environment variables for the current session:

```powershell
$env:NOTEBOARD_SIGNING_IDENTITY = 'Apple Development: your signing identity'
$env:NOTEBOARD_PROVISIONING_PROFILE = Join-Path $PWD 'release/signing-setup/DerivedData/Build/Products/Debug/NoteboardSigning.app/Contents/embedded.provisionprofile'
npm run install:macos
open (Join-Path $HOME 'Applications/Noteboard.app')
```

This builds a standalone app at `release/Noteboard.app`, embeds the profile, signs it with the selected identity and copies it into `~/Applications`. Packaging checks the profile's expiry, macOS platform, app identifier, access group and authorised signing certificate before building or replacing anything. Missing profiles or ambiguous identities fail with setup instructions; ad hoc signing is no longer used. The installed app runs without the repository, Node or a development server. It uses the existing Inquiry desktop data directory, preserving Boards and provider settings. Development signing does not provide notarisation or establish suitability for distribution.

`npm run package:macos` builds without installing. Installation refuses to overwrite an existing bundle. To reinstall or update, quit Noteboard, then run:

```powershell
pwsh -NoProfile -File ./scripts/reinstall-macos.ps1
# Alternatively:
npm run reinstall:macos
```

The reinstall script builds before replacing `~/Applications/Noteboard.app`, verifies the installed signature and opens the app. It also works for a first installation. Saved Boards, settings and credentials are stored separately and are retained.

## Appearance

The compact workspace toolbar shows the Board title, Rename and Consolidate. **More** contains appearance settings, Board import, ChatGPT conversation import, export and Board deletion. Explore/Synthesis and Board counts occupy the second row.

Use **Hide sidebar** in the top-left of the workspace toolbar to give the canvas or synthesis document more room. The same button becomes **Show sidebar** so you can restore Boards, artefacts and provider controls. The sidebar starts visible when the app opens; toggling it retains the current Board, reader and canvas zoom.

Open **More → Appearance settings** in the toolbar to choose Light, Dark or Follow system, accent colour, reading text size and grid visibility. Note style offers Classic (the default), with lightly tinted rounded cards, colour tabs and restrained shadows, or Sticky notes, with brighter paper colours, prominent Takeaways, adhesive strips, curled corners and deeper shadows on a warm textured canvas, plus a subtle matching tint in the reader. Both styles support light and dark themes. Interface fonts offer Standard or Monospace; reading fonts offer Sans-serif, Serif or Monospace. Monospace uses Consolas when installed, then Menlo, Monaco or the system monospace font. Changes preview immediately; Save retains them across Boards and restarts, Cancel restores saved preferences, and Reset defaults restores the original appearance.

The styles also change how you scan Notes. **Classic** balances questions and Takeaways. **Sticky notes** leads with the Takeaway, with the question underneath. **Blueprint** uses compact question nodes: activate **Peek takeaway** with a click or Enter to reveal the complete Takeaway in place. **Index cards** uses wider reference cards with a number rail, version/origin details and roomy ruled extracts. **Studio** emphasises large Takeaways and a full-width **Explore this idea** action. Sticky notes and Studio fold revision controls and connected Notes into **Versions, editing & connected Notes**, leaving more space for reading; expand it to access the same tools. At distant zoom, all styles prioritise the question. Layout changes retain existing Note positions; they never rearrange the Board.

All five styles support light/dark mode, accent and font preferences, live preview, Cancel, Reset defaults and saving across restarts. Note styles change presentation only; Board data, Highlight anchors and response text are retained.

The detailed Note reader starts at 40% of the workspace width, targeting 420–640 px within available-space limits. Drag its left edge to resize it. With the divider focused, Left/Right arrows adjust the width, Shift makes larger adjustments, and Home/End select the narrowest/widest size. Expanding and collapsing a Note retains its side-panel width while it is open. Resizing leaves space for the canvas and adapts to the window size.

## Local Ollama

Install/start Ollama independently, and pull a model appropriate to your machine. In Noteboard provider settings, select Ollama, retain the loopback server address, choose **Discover**, and select an installed model. Set a context budget within the model's maximum. The adapter sends complete context and a 1,024-token output cap.

No model downloads, live inference requests, paid API setup or subscription authorisation happen automatically.

## ChatGPT account support

The desktop app implements the documented [local-app ChatGPT plan usage flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), using dynamic public-client registration, PKCE, a loopback callback and RS256 ID-token validation. It requires an eligible ChatGPT account and explicit plan-use consent; availability remains subject to OpenAI’s preview restrictions.

Choose ChatGPT in provider settings and add an account or workspace with **Continue with ChatGPT**. Models load automatically. Each account’s discovered model names, thinking-level metadata and discovery time are saved locally and reused after restarting. **Refresh models** fetches current availability; a failed refresh preserves the previous catalogue. Signing in or out clears that account’s catalogue. Saved accounts can be selected independently; signing out retains the issued registration for later sign-in. **Manage usage** opens ChatGPT’s usage settings. The app never uses `OPENAI_API_KEY`, existing Codex credentials, or a separately billed API fallback.

The model dropdown shows the account’s available model names. **Thinking effort** offers Model default and the levels advertised for that model, with its reported default shown when available. Missing capability metadata is labelled and offers Model default; an explicitly empty list offers no overrides. Unrecognised future levels are recorded but disabled until supported by this app. A previously selected level missing from a refreshed catalogue stays visible as unconfirmed until you change it. Model default always leaves the effort parameter out of the request. If ChatGPT rejects a level, select Model default or another supported level and retry. Higher effort can increase latency and plan usage. Changing provider, account or model resets the override. Generated Notes and synthesis preserve explicit effort metadata; historical and imported responses remain unchanged. See the [official reasoning guide](https://developers.openai.com/api/docs/guides/reasoning).

In a Note prompt, press **Enter** to send or **Shift+Enter** to add a line. Empty questions and IME composition do not submit.

New Note composers, including Highlight branches, start with your saved provider model and thinking effort. ChatGPT composers and revisions reuse the saved model catalogue, with **Refresh models** available; Ollama retains **Discover models**. For ChatGPT, **Thinking effort** also applies to that request only; changing the model resets it to **Model default**. Saved provider settings and later composers retain your defaults. Supported effort levels depend on the model; rejected requests keep the draft available for correction and retry.

While a Note or synthesis is generating, a progress indicator appears with **Cancel generation**. Partial response text is not shown; the formatted result opens after generation completes successfully.

New Notes ask the selected model to answer naturally, lead with the useful conclusion and include broader context only when helpful. **Where this fits** is optional, and answers do not need a concluding **Takeaway**. The canvas uses an explicit Takeaway if present or a short extract from the first substantive paragraph; you can edit it independently. Follow-ups retain their selected passage and ancestral conversation. Existing and imported responses stay as originally recorded.

In **Provider settings**, edit **Custom instructions** to personalise future Notes and generated synthesis. Defaults cover response style, Australian English, accuracy, uncertainty, sources and recommendations. **Save settings** commits the draft; **Cancel** or closing the dialog discards it. **Restore response preferences** restores the default draft. Clearing the field keeps only basic Noteboard guidance. These settings apply across providers; scripted demo responses do not follow them. Web search is available for ChatGPT Notes when enabled. The app has no connection to ChatGPT projects or personalisation. Instructions actually used are recorded in generation context and included in Board exports; changing settings never rewrites earlier responses.

Credentials are written atomically with owner-only permissions to `chatgpt-credentials.bin` in the app’s user-data directory and excluded from SQLite, renderer state and Board exports. On macOS, AES-256-GCM protects the file with a random key held in the data protection Keychain under user-presence access control. Unlocking uses the native Touch ID prompt with macOS password fallback when necessary. Other platforms use Electron `safeStorage`; insecure backends, including Linux’s plaintext fallback, are refused. Refreshes are serialised within the process. A single-instance lock prevents concurrent desktop processes from racing credential rotation.

Account listings reuse credentials already unlocked in the main process; creating another Board does not require unlocking them again. With no credential file, listing accounts does not access secure storage. Opening a current-format file does not rewrite it. The first access to an older macOS credential file migrates it automatically, preserving registrations and tokens. That one migration may still ask for the original login-Keychain password, followed by Touch ID. Cancellation or failure leaves the old file intact. Later launches unlock the new Keychain item through user presence. macOS can require a password when Touch ID is unavailable or locked out; the app cannot override system policy. See [Apple’s Keychain access-control guidance](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility).

The native module is compiled with Xcode command-line tools during desktop builds, using the pinned `node-api-headers` development dependency. It is loaded only by main, with no new renderer or preload permissions. `npm run dev` uses an unprovisioned Electron host, so macOS ChatGPT credentials require the signed installed app; browser/demo and Ollama development remain available. Never use mock Keychain flags with real credentials. The vault key is device-local and tied to the credential path: copying the encrypted credential file to another Mac or directory is not a credential backup or supported migration.

ChatGPT inference uses account-specific model discovery and `POST /v1/responses` with `store: false`, `stream: true` and complete effective messages. System instructions become developer messages before both transmission and provenance recording. The local context estimate includes a 1,024-token reserve; this preview does not support an output cap or exact model-budget discovery, so the service may still reject a request or generate a longer response. No context is automatically reduced.

Automated tests mock authentication and inference and do not establish live account eligibility or model quality. To validate live support, sign in explicitly, create a Note and a Highlight branch, cancel a generation, consolidate selected Notes, and reopen the app. Review actual plan usage in ChatGPT settings.

Double-click a Note's heading in the reader to rename it inline. Enter or clicking away saves; Escape cancels, and clearing the title restores the prompt as its display title. Keyboard users can focus the heading and press Enter or Space. The separately labelled **Prompt** still supports double-clicking to edit the prompt and regenerate.

## Data and failures

ChatGPT Note composers and generation revision dialogs include **Allow web search when useful** and **Attach files**. Search starts enabled unless you turn off **Enable web search by default for Notes** in Provider settings. The per-request switch does not change your saved default. **Sanity check & improve** can now use search when enabled. A completed response shows whether search was actually used, with clickable inline citations and a source list; source links open your external browser. Availability depends on the model and account/workspace policy. Errors remain visible without a billed-provider fallback. Generated synthesis uses selected Notes and their recorded sources rather than enabling new searches.

File inputs accept PDF, Word (`.docx`), PowerPoint (`.pptx`), Excel (`.xlsx`) and text-based `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.html` and `.xml` documents. Limits are 5 MB per file and five files/10 MB per complete request, including ancestral files. New attachments can be removed from the draft before submission; saved inputs remain with their source version. Files are sent inline through your ChatGPT plan connection and saved in Board records and exports. Follow-ups and revisions retain the relevant files. For Word and PowerPoint, only extracted text is provided; convert to PDF to include diagrams or page images. Spreadsheet processing uses summaries and up to the first 1,000 rows per sheet; supply a text document for full-data reading. File token estimates are approximate; PDF pages and compressed documents may use more context than their byte size suggests. Context-limit or unsupported-file errors preserve your draft. Ollama and demo modes do not support these file inputs and refuse file-bearing history without dropping it.

Use **Sanity check & improve** in a Note's revision controls to review the response version you are viewing. Review or edit the follow-up prompt, optionally choose a model, then select **Check & improve**. The request includes the response and its conversation, asks the model to check its reasoning and claims, and returns a complete improved answer as a new version of the same Note. The original question, earlier responses and existing Highlight/synthesis links remain available. This is model self-review rather than external source verification; demo output remains synthetic. Failed or cancelled requests leave the review draft available for retry.

Open a Note to use **Edit prompt and regenerate**, **Regenerate response**, or **Edit response**. Each adds a version; the **Version** dropdown reopens earlier prompts and responses. Regeneration uses the viewed version's ancestral path with your currently configured provider and response preferences. **Discover models** offers a model override for that request without changing saved provider settings. Imported originals retain unknown historical context; regeneration creates a new request from their preserved visible conversation. Generation failures and cancellation leave the draft available for retry.

**Edit response** accepts Markdown/LaTeX and saves a **Human-edited** version without inference. The original prompt and responses remain available. Existing branches and synthesis links retain their exact source versions; a new branch uses the version you are viewing. The canvas and newly created synthesis use latest versions, and human edits are identified in synthesis sources. Revising a parent never automatically regenerates its descendants. Board exports now use schema version 4; existing versions 1–3 migrate when opened, while older app builds cannot open new exports.

On macOS, select text in an editable field and right-click (or Control-click) to access the native editing menu, including Apple Intelligence **Writing Tools** when available and enabled on your Mac. This works in prompt and response revision editors, composers and document editors. Review the result before using the editor's normal Save or generation action; Cancel discards the draft. Writing Tools availability and processing are managed by macOS, independently of Noteboard's configured provider. Read-only responses must first be opened with **Edit response**.

On macOS, Noteboard disables Force Click lookup through an app-local preference so pressing firmly on the canvas does not invoke Dictionary. Ordinary clicking, dragging and Highlight selection remain available. Physical trackpad behaviour needs a manual check after installing and restarting the desktop app.

Production builds use [Rolldown chunk groups](https://rolldown.rs/reference/OutputOptions.codeSplitting) in `vite.config.ts` to separate React, canvas, KaTeX maths and remaining vendor code from the app. The standard 500 kB warning limit remains enabled. These are static chunks loaded together, improving cache separation without deferring the reader or changing Highlight timing; total startup code is broadly unchanged. All scripts, styles and maths fonts remain bundled for offline desktop use.

Open **More → Delete Board** in the Board toolbar to delete a Board, or open a Note and use its bin icon to **Delete Note**. Both actions require confirmation and cannot be undone. Note deletion includes every descendant; the confirmation shows the total count. Existing synthesis keeps read-only copies of deleted source Notes, available through source links. Board deletion removes its Notes and synthesis documents. Deleting the last Board opens a fresh empty Board.

Desktop Boards and settings live in `inquiry.sqlite` under the existing Electron user-data directory. Noteboard retains the original Inquiry storage location so renaming the app keeps saved Boards and provider settings available. Export a JSON Board for a portable copy. Import gives it a new Board identity and preserves internal provenance. Browser preview data is isolated in localStorage and is not automatically transferred to desktop; use export/import.

Generation errors retain the entered question for retry. Cancellation creates no partial Note or artefact. Persistence errors appear in the workspace; export the Board if saving fails. Only one generation runs at a time; changing Boards/provider settings is disabled during inference.

See [testing](testing.md) for validation commands and [roadmap](roadmap.md) for remaining scope.

See [ChatGPT conversation import](chatgpt-import.md) for importing a text conversation as a Note chain and adding retrospective Highlights.
