# Noteboard project guidance

Use Australian grammar and spelling. When Python tooling is needed, use `python3` from the active pyenv version.

Use PowerShell (`pwsh`) for terminal scripts and all shell/script examples in chat and documentation. Use PowerShell syntax for environment variables and paths. Keep application build tooling in JavaScript where appropriate; run it from `pwsh`.

## Product intent

Noteboard is a human-directed, provider-independent spatial conversation environment. Read [the product plan](docs/product-plan.md) for scope and [architecture](docs/architecture.md) before changing data flow.

- Only a human creates branches. Never generate or rearrange investigative branches autonomously.
- A Board is one directed rooted tree; each child has exactly one parent. Highlight branches preserve one exact Highlight. Imported continuation Edges preserve chronological source message references and may have an explicitly confirmed retrospective Highlight.
- Imported responses preserve original visible text and source identities. Unknown original generation context, model and usage must remain unknown; never manufacture generation records or automatically apply exported instructions.
- Keep original prompts and response versions immutable. Editing a Takeaway changes only the Takeaway.
- Include the complete ancestral path, selected Highlight and new prompt in generation context. Exclude siblings. Record exactly the messages sent.
- Never silently truncate, summarise or discard context to fit a model. Depth reminders are advisory and independent of context limits.
- Synthesis keeps source Note/version references and earlier document versions. The Board remains available.
- Demo responses must remain clearly identified as synthetic. Do not present demo synthesis as real model inference.
- Credentials never belong in Board records or exports. Paid inference must be explicitly configured; never fall back to a billed provider.

## Repository map and checks

- `src/core/`: graph schema, context, selection anchors, providers and synthesis.
- `src/features/`: feature components, local state and workflow coordination; see the ownership map in `docs/architecture.md`.
- `src/App.tsx`: feature composition and cross-feature navigation. `src/components/` contains reused rendering/input components.
- `src/styles.css`: ordered stylesheet imports; feature styles live in `src/styles/`.
- `electron/`: trusted main process, narrow preload bridge, SQLite and local Ollama adapter.
- `tests/`: domain, persistence, provider and end-to-end verification.
- `docs/`: maintained product plan, decisions, setup and testing.

Use Node 24+. `npm ci`, `npm run dev`, `npm run check`, `npm run test:e2e`. See [development](docs/development.md) for browser installation and desktop tests. Keep `package-lock.json` committed and use npm.

Renderer code must not gain direct filesystem, Node or network access. Validate external JSON and IPC input. Keep `contextIsolation`, sandboxing and `nodeIntegration: false`. Ollama is local-only in this version.

Run relevant tests for changed behaviour, typecheck and build before delivery. Test branching, source navigation and reopening data when changing anchors or persistence. Update architecture/decisions when the design changes. Do not claim live inference validation from synthetic or mocked tests.

## Refactor maintenance

Keep feature-specific components and hooks together. Pass named actions across features; keep simple state local and avoid a universal controller/context. Instantiate the shared generation owner and Board persistence owner once in the application. Keep save ordering and deleted-Board protection together.

Preserve the response DOM surface when extracting reader code: equivalent-looking markup can change Highlight offsets. Preserve stylesheet import/rule order when moving CSS. Browser suites live in `tests/browser/`; keep Playwright discovery and parameterised cases intact when moving tests.

Review responsibilities before extending files beyond 400 lines. `npm run size:report` lists these files; `npm run check` rejects authored files over 500 lines without a bounded, justified exception in `scripts/file-size-exceptions.json`. Count normally formatted physical lines; do not compress or fragment cohesive code to satisfy the report.

## Ideas and approved work

[docs/ideas.md](docs/ideas.md) is the human-maintained ideas inbox. Entries are exploratory proposals, not approved requirements or implementation instructions.

- Consult relevant entries when explicitly asked to brainstorm, review ideas, evaluate possible features or plan future work. Do not routinely load the entire inbox for unrelated implementation tasks.
- When reviewing ideas, consider existing product requirements, architectural constraints and design decisions.
- Implementation or promotion requires explicit user direction. Do not automatically implement ideas, create GitHub Issues or promote entries into authoritative documentation.
- Preserve original ideas unless the user explicitly requests their removal or modification.

## Project skills

The project skill [inquiry-development](skills/inquiry-development/SKILL.md) describes the feature and verification workflow. Read it when implementing or reviewing Noteboard's graph, provider, provenance or synthesis behaviour. It is stored in `skills/` because this workspace's `.agents/` directory is read-only; AGENTS.md provides the explicit discovery route.
