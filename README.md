# Inquiry

Explore knowledge spatially and synthesise understanding linearly.

Inquiry is a local-first Electron research prototype. Ask a question, read the response, highlight a passage and create an editable follow-up question. Your Board records the branching inquiry; synthesis turns chosen Notes into editable Markdown artefacts with source links.

## Run

Requires Node.js 24+ and npm.

```sh
npm ci
npx install-electron --no
npm run dev
```

For a production build:

```sh
npm run build
npm start
```

`npm run dev:web` opens a browser-only demo at http://127.0.0.1:5173. The preview uses browser storage and synthetic responses; the desktop app uses SQLite and supports Ollama.

## Try the workflow

1. Open a sample Note, or create a new inquiry and ask a question.
2. Select text in the formatted response and choose **Explore this passage**.
3. Edit the suggested `What is <Highlight>?` question and create the branch.
4. Drag Notes, pan and zoom. Click an Edge label to revisit its source Highlight.
5. Select Note checkboxes, then **Consolidate**. Choose a full Board, an ancestral branch or selected Notes.
6. Edit the document, save a revision, preview source links and return to Explore.

Provider settings support the synthetic demo and a locally running Ollama server. Use **Discover** to list installed models. Context limits are checked before generation; history is never silently shortened. No API keys or subscriptions are required by this version.

## Documentation

- [Product plan](docs/product-plan.md)
- [Architecture](docs/architecture.md) and [decisions](docs/decisions.md)
- [Development](docs/development.md), [testing](docs/testing.md) and [roadmap](docs/roadmap.md)
- [Agent instructions](AGENTS.md) and [project development skill](skills/inquiry-development/SKILL.md)

The initial exploration and synthesis MVPs are implemented. Hosted providers, eligible ChatGPT sign-in, rich-text editing, automatic continuation roots, packaged installers and research evaluation remain future work. Live Ollama requires a locally installed model; the included examples are explicitly synthetic.
