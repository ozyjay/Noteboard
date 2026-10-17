# Refactor verification — 17 October 2026

Implemented the seven stages from the supplied brief against starting commit `a9313d4d2b2ee57901d1f1dc33a5df572076f7d6`. The working tree was clean at the start. Work remains local and uncommitted; no push, merge, publication or app installation was performed.

The renderer now uses `src/features/{boards,canvas,composer,dialogues,generation,reader,settings,synthesis,workspace}/`. Feature components sit beside their state and operations. `src/components/` retains reused Markdown, research inputs/records and thinking-effort controls. The existing model catalogue cache, provider abstraction, core schemas and Electron/preload implementation remain foundations. All ten relocated existing feature components retain their implementations; a source comparison excluding import declarations verified the moves.

`App.tsx` composes these owners and connects navigation. Composer and synthesis hooks own their drafts and request preparation. Reader state, rendered selection, historical/archived source navigation and revision saving have distinct responsibilities. Canvas measurement/viewport state remains mounted with the application. One generation owner handles all requests and cancellation. One persistence owner holds both the save queue and deleted-Board protection. Named actions connect settings, Board menus and toolbar commands. Note completion/insertion and shared document revision construction live in core. See the [ownership and transition map](architecture.md#renderer-feature-ownership).

| Boundary                    |                        Before | After                                                                                 |
| --------------------------- | ----------------------------: | ------------------------------------------------------------------------------------- |
| `src/App.tsx`               |                   3,044 lines | 325 lines of composition, workspace state and navigation                              |
| `src/styles.css`            |                   2,069 lines | 13-line import manifest; 12 stylesheets, largest 370 lines                            |
| `tests/browser.spec.ts`     |                   2,790 lines | 19 feature suites under `tests/browser/`, largest 457 lines                           |
| Existing feature components | Mixed under `src/components/` | Collocated by feature; largest remains the unchanged 389-line Note revision component |
| Feature coordination hooks  |               Embedded in App | Largest is `useSynthesis`, 189 lines; no universal controller/context                 |

Counts are normally formatted physical lines, excluding the final empty line after a terminating newline. No formatting compression or assertion removal was used.

| Stage/checkpoint                           | Observed verification                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Baseline                                | Formatting, typecheck, 75 unit/integration cases, production renderer/Electron build and 43 browser/desktop cases passed. Baseline screenshots retained from isolated fixtures. |
| 2. Browser suite organisation              | Mechanical moves preserved all 43 expanded case identities and browser/desktop assignments. No shared fixture abstraction was introduced.                                       |
| 3. Interface extraction                    | The first component extraction and moved suites passed all 43 browser/desktop cases.                                                                                            |
| 4. State and domain operations             | Composer/settings/synthesis state and record construction were extracted, with typechecking and the subsequent full reader/canvas checkpoint covering the completed changes.    |
| 5. Reader, canvas and dialogue interaction | Typecheck/build and all 43 browser/desktop cases passed after extracting these boundaries.                                                                                      |
| 6. Persistence and generation              | Full checks passed with 75 unit/integration cases and 44 browser/desktop cases, including the added delayed-save regression.                                                    |
| 7. Styles, collocation and guardrails      | Final formatting, size check, typecheck, 75 unit/integration cases, production renderer/Electron build and all 45 browser/desktop cases passed.                                 |

The first sandboxed Playwright attempt could not launch Chromium because macOS denied its Mach-port registration. Running the same isolated tests outside that restriction established the passing baseline. This was an execution restriction, not an application test failure. There were no remaining baseline or final test failures.

The [case inventory](refactor-test-inventory.json) records all 75 unchanged unit/integration cases and all 45 final Playwright cases, with the original file for each preserved case. The baseline had 38 browser and five desktop cases; the result has 40 browser and five desktop cases. Parameterised viewport widths (900, 1150 and 1512 px) and all five Note styles remain expanded and discovered.

| Critical workflow                                                                 | Principal coverage                                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Delayed saves, deletion/retry, inactive and last-Board deletion                   | `persistence-ordering.spec.ts`, `deletion.spec.ts`, `board-management.spec.ts`, `deletion.test.ts`, `store.test.ts` |
| Cancelled/failed generation and retained request drafts                           | `composer-requests.spec.ts`, `revision-requests.spec.ts`, `providers.test.ts`, `chatgpt.test.ts`                    |
| Exact Highlights, repeated text, inline formatting, maths and historical surfaces | `highlight-selection.spec.ts`, `maths.spec.ts`, `selection` checks in `core.test.ts` and `math.test.tsx`            |
| Version-pinned branch/synthesis sources and revisions                             | `revision-editing.spec.ts`, `branching-journey.spec.ts`, `reader-navigation.spec.ts`, `revisions.test.ts`           |
| Account-specific catalogues and late discovery                                    | `model-discovery.spec.ts`, `composer-requests.spec.ts`, `model-catalogues.test.ts`, desktop catalogue reopening     |
| Canvas mounting, viewport, placement and reader resizing                          | `workspace-layout.spec.ts`, `canvas-placement.spec.ts`, `reader-layout.spec.ts`                                     |
| Document history, dirty export and retained drafts                                | `synthesis-history.spec.ts`, `branching-journey.spec.ts`, `maths.spec.ts`                                           |
| Reopening, imports and renderer/preload isolation                                 | Browser reload scenarios, `conversation-import.spec.ts`, `desktop.spec.ts`, `store.test.ts`                         |

The two added browser cases target extraction risks rather than reproducing implementation details. One holds an initial save, queues a rename, confirms deletion, releases the save and verifies that later snapshots cannot recreate the deleted Board, including after reopening. The other exports a dirty synthesis and verifies one appended revision, unchanged original/source records and no duplicate revision after navigation/reopening.

The CSS split preserved the ordered parsed representation of all 337 top-level rules/comments, including declarations, selectors, media rules and comments. The final production app stylesheet retains baseline hash `index-BOvCnGtL.css` (35.19 kB). No CSS layers or selector/specificity changes were introduced.

All 43 baseline screenshot captures have final counterparts. Twenty-nine are byte-for-byte identical. The other 14 have unchanged image dimensions and between 0.0006% and 1.5528% differing pixels. Representative non-identical pairs were visually inspected: differences include transient canvas outlines/shadows, scrollbar rendering and generated source-version identifiers; no layout or reader-content regression was observed. These are comparison observations, not a claim of exact pixel parity. All five light/dark Note styles and the three viewport-width scenarios passed their existing assertions.

Local [screenshot comparisons](../test-results/refactor-evidence/screenshots.json) and checkpoint/final logs are retained under `test-results/refactor-evidence/`, with baseline/final PNGs. That directory is ignored and is cleared by a future Playwright run; it is evidence for this local session rather than a committed visual-baseline suite.

`npm run size:report` lists files over 400 lines. `npm run check` now includes `size:check`, requiring a bounded explanation above 500 lines in `scripts/file-size-exceptions.json`. The single exception is the existing 759-line ChatGPT protocol/protected-credential integration suite, retained with its shared mock-server/identity harness and no permitted growth. Existing authentication implementation (473 lines), desktop tests (443) and the request-override browser scenario (457) remain cohesive and under 500 lines. Runtime source has no file over 500 lines.

App remains above the suggested 100–250-line composition target at 325 lines. This is intentional: explicit connections among the features and the independent dialogue open/busy policy remain visible together. It contains no embedded reader, provider/composer form, request implementation or persistence queue. Further reduction would mainly move this composition into another wrapper. Review responsibility growth before extending it.

Two existing observations were left separate from the refactor: the browser logs can report `ResizeObserver loop completed with undelivered notifications` around reader resizing, including in the baseline; and Provider settings retains broad wording that Noteboard cannot browse despite the optional ChatGPT search controls. Neither was changed or promoted into a new requirement.

Validation used synthetic/demo responses, mocked provider/authentication endpoints and isolated temporary desktop data. It establishes the tested request, provenance, persistence, rendering and interaction behaviour. Live ChatGPT/Ollama inference, real credential migration/Touch ID, native Writing Tools, physical trackpad behaviour and response quality were not validated by this work.
