# Noteboard

Explore knowledge spatially and synthesise understanding linearly.

Noteboard is a local-first Electron research prototype. Ask a question, read the response, highlight a passage and create an editable follow-up question. Your Board records the branching inquiry; synthesis turns chosen Notes into editable Markdown artefacts with source links.

## Run

Requires Node.js 24+, npm and PowerShell (`pwsh`). Terminal examples use PowerShell.

```powershell
npm ci
npx install-electron --no
npm run dev
```

For a production build:

```powershell
npm run build
npm start
```

`npm run dev:web` opens a browser-only demo at http://127.0.0.1:5173. The preview uses browser storage and synthetic responses; the desktop app uses SQLite and supports Ollama and ChatGPT plan usage.

On macOS, `npm run install:macos` installs a standalone app in `~/Applications/Noteboard.app`. See [local installation](docs/development.md#local-macos-installation) for updating and launching it.

## Try the workflow

1. Open a sample Note, or create a new inquiry and ask a question.
2. Select text in the formatted response and choose **Explore this passage**.
3. Edit the suggested `What is <Highlight>?` question and create the branch.
4. Drag Notes, pan and zoom. Click an Edge label to revisit its source Highlight.
5. Select Note checkboxes, then **Consolidate**. Choose a full Board, an ancestral branch or selected Notes.
6. Read the formatted document, choose **Edit** to change its Markdown/LaTeX source, save a revision, and follow source links to return to Explore.

Responses and synthesis render Markdown and LaTeX maths. Use `$x^2$` or `\(x^2\)` inline, and `$$` on separate lines or `\[x^2\]` for display equations. Code remains literal. Selecting part of an equation explores the complete equation and preserves its LaTeX for the follow-up. Markdown export retains the original source notation.

Provider settings support the synthetic demo, local Ollama and eligible ChatGPT plan usage. For ChatGPT, choose **ChatGPT — use your plan**, select **Continue with ChatGPT**, allow plan usage in your system browser, then **Discover** and choose an available model. Save settings before asking a question. **Manage usage** opens ChatGPT settings to review usage, access and any authorised credits. Account credentials are encrypted separately from Boards using the operating system credential store. No OpenAI API key or paid API fallback is used. Context budgets are checked before generation; history is never silently shortened. Demo and Ollama remain available without a ChatGPT subscription.

## Documentation

- [Product plan](docs/product-plan.md)
- [Architecture](docs/architecture.md) and [decisions](docs/decisions.md)
- [Development](docs/development.md), [testing](docs/testing.md) and [roadmap](docs/roadmap.md)
- [Ideas and feature requests](docs/ideas.md) — exploratory ideas rather than the implementation backlog
- [Agent instructions](AGENTS.md) and [project development skill](skills/inquiry-development/SKILL.md)

The initial exploration and synthesis MVPs are implemented. Separately billed hosted providers, rich-text editing, automatic continuation roots, packaged installers and research evaluation remain future work. Live Ollama requires a locally installed model; the included examples are explicitly synthetic.
