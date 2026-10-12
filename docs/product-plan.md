# Noteboard

## Product and Development Plan — v0.1

**Status:** Initial concept consolidated from design exploration  
**Purpose:** Establish the product vision, interaction model, functional requirements, technical direction and development roadmap for an initial research prototype.

---

## 1. Product vision

**Noteboard is a human-directed, provider-independent, spatial GenAI conversation environment designed to support exploration, understanding and synthesis.**

Users investigate topics through interconnected sticky Notes. Each Note contains a user-authored prompt and a GenAI-generated response.

Rather than following a single linear chat, users select passages in responses that they want to understand or investigate further. Each selection can create a new, connected Note, allowing the user to develop a branching exploration.

The resulting canvas represents the user's individual inquiry journey.

When ready, the user can synthesise their exploration into a coherent, editable, linear artefact while preserving links to the original Notes.

### Core principle

**The human directs the inquiry. The GenAI system supports the exploration, explanation and synthesis.**

The application does not independently decide which questions should be investigated or automatically grow the mind map.

---

## 2. Core terminology

| Term          | Definition                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------ |
| **Noteboard** | The application                                                                            |
| **Board**     | The spatial workspace containing an exploration                                            |
| **Note**      | One human-authored prompt and its GenAI response                                           |
| **Highlight** | One contiguous passage selected from a Note's response                                     |
| **Edge**      | A parent-to-child connection: a Highlight branch or an imported chronological continuation |
| **Branch**    | A path of connected Notes arising from successive human-directed investigations            |
| **Takeaway**  | A concise representation of the principal point of a response                              |
| **Explore**   | The spatial, nonlinear interaction mode                                                    |
| **Synthesis** | The mode for producing linear artefacts from an exploration                                |

**Consolidate** is the user action that initiates synthesis.

---

## 3. Primary user experience

### 3.1 Starting an exploration

1. The user creates a new Board.
2. The user writes an initial question or prompt.
3. The selected GenAI provider generates a response.
4. Noteboard creates the starting Note.
5. The Note appears on the Board.

A Board may contain a single Note or an extensive branching exploration.

### 3.2 Exploring an existing Note

The user opens or zooms into a Note to read its complete response.

While reading, they may encounter an unfamiliar term, interesting explanation, questionable claim or concept requiring further investigation.

The user selects a passage in the response.

Noteboard presents a new Note composer containing:

- The selected Highlight, displayed as contextual information.
- A prefilled, editable prompt: `What is <Highlight>?`
- A submission control.

The user can accept the suggested question or rewrite it entirely.

No GenAI request is needed to generate this default prompt.

### 3.3 Creating a child Note

When the user submits the new prompt:

1. Noteboard determines the ancestral context.
2. The selected provider generates a response.
3. A new Note is created.
4. An Edge connects the parent Note to the child.
5. The Edge is labelled with the original Highlight.
6. Noteboard positions the new Note near its parent.

The original Note and its response remain unchanged.

The user may repeat this process at any depth or explore different Highlights from the same Note.

### 3.4 Human-directed branching

Only the human initiates creation of a child Note.

GenAI may assist with answers and later synthesis, but must not autonomously select Highlights, generate investigative branches or restructure the Board.

The spatial representation records the human's decisions about what deserves investigation.

---

## 4. Note design and semantic zoom

The sticky-note metaphor is central to the interface.

A Note must support both spatial overview and detailed reading without requiring the entire response to remain visible on the Board.

### 4.1 Three presentation levels

**Overview**

At distant zoom levels, display a compact representation of the prompt, potentially shortened.

The objective is to help users recognise Notes and navigate the overall exploration.

**Board view**

Display:

- Prompt, or a concise synopsis of a complex prompt.
- Response Takeaway.
- Subtle indicators of connections or other relevant metadata.

Outgoing Edge labels display the Highlights that motivated subsequent investigations.

**Detailed view**

Display:

- Complete prompt.
- Complete formatted GenAI response.
- Existing Highlight anchors.
- Relevant Note metadata.
- Text selection and branching functionality.

The detailed view should support comfortable reading without disrupting the Board's spatial arrangement.

### 4.2 Adaptive summaries

The Takeaway should express the principal point of the response rather than mechanically extracting its final sentence.

Its length should account for response complexity and available display space.

Initially, Noteboard can generate Takeaways through the selected provider or a lightweight summarisation mechanism. User correction should be possible.

The original response must always remain accessible.

### 4.3 Configuration

Start with sensible defaults.

Potential optional settings include:

- Compact summary information density.
- Prompt and Takeaway display preferences.
- Board zoom and presentation preferences.

Avoid exposing unnecessary configuration during ordinary exploration.

---

## 5. Graph and Highlight model

### 5.1 Initial structure

Each exploration forms a directed, rooted tree.

- A starting Note has no parent.
- Every child Note has exactly one parent.
- A Note may have any number of children.
- Each Highlight branch Edge represents exactly one Highlight. Imported continuation Edges record original chronology and may carry an explicitly confirmed retrospective Highlight.
- No multi-Highlight selection is required to create a Note.
- The same source passage may support multiple independent branches.

This avoids multi-parent context ambiguity and hypergraph complexity in the initial version.

### 5.2 Highlight provenance

Each Highlight branch Edge must preserve:

- Source Note identifier.
- Source response version.
- Exact Highlight text.
- Position or range within the source response.
- Child Note identifier.

Selecting an Edge should allow the user to find the original Highlight in its parent response.

Highlights are persisted when used to create branches. Ordinary temporary text selection does not need to create permanent annotations.

Imported ChatGPT text conversations may be imported as one user-selected chain of Notes. Preserve original visible prompts/responses and available source identities, distinguish unknown generation context, and never invent Highlight provenance. Chronological continuations can be annotated retrospectively without changing the original messages. See [conversation import](chatgpt-import.md) for the approved first-version workflow.

### 5.3 Edge presentation

At normal Board zoom, the Highlight appears as an Edge label.

At distant zoom levels, labels can be shortened or hidden to reduce visual clutter.

The complete Highlight remains accessible through the Edge.

---

## 6. Context inheritance

Each child Note inherits the conversational history along its ancestral path back to the starting Note.

For a new Note D created from Note C:

**Context = Note A + Note B + Note C + selected Highlight + new prompt**

Each ancestral Note contributes its prompt and response in chronological order.

Notes belonging to unrelated branches are excluded by default.

### 6.1 Provider-independent assembly

Noteboard constructs the context rather than relying on a provider's persistent conversation history.

This allows different Notes to use different GenAI providers while preserving the logical exploration.

Each generated response retains a record of the effective context supplied to its provider.

### 6.2 Context growth

The application should track estimated context size against the selected model's capabilities.

Initially, use complete ancestral context wherever feasible.

Do not silently discard, truncate or summarise historical Notes.

### 6.3 Branch depth

Introduce an optional, configurable soft depth reminder.

**Proposed initial default: eight Edges from the root.**

At the threshold, Noteboard may suggest consolidating a branch or continuing from a new starting Note.

The user may dismiss the reminder and continue exploring, provided the context requirements can be met.

Depth restrictions and provider context limits must remain separate concepts.

### 6.4 Continue from here

A future feature could consolidate an existing branch into a user-reviewed contextual starting Note.

The original exploration remains intact and linked to the new starting Note.

This supports extended investigations without requiring their complete historical context in every subsequent request.

---

## 7. Synthesis mode

Synthesis transforms a nonlinear exploration into an organised linear artefact.

The Board remains intact and accessible.

### 7.1 Selecting the material

Users may synthesise:

- The entire Board.
- One branch.
- A manually selected collection of Notes.

### 7.2 Synthesis outputs

**Learning journey**

Preserves the original prompts, responses and exploration sequence in a readable linear form.

**Integrated explanation**

Combines relevant explanations into a coherent account organised by concepts rather than exploration chronology.

**Structured artefact**

Produces a particular document type, such as:

- Study notes.
- A development plan.
- A research brief.
- A technical explanation.
- A tutorial or learning resource.

These document types share a common synthesis mechanism and differ primarily in their structure and instructions.

### 7.3 Synthesis requirements

The synthesis system should:

- Identify related concepts across selected Notes.
- Organise material logically.
- Reduce unnecessary repetition.
- Preserve important qualifications and uncertainty.
- Identify unresolved questions or conflicting explanations.
- Maintain references to originating Notes.
- Produce editable content.

The user has final editorial control.

### 7.4 Returning to exploration

Synthesis is not a terminal operation.

The user can return to the Board, investigate additional questions and regenerate or revise the synthesised artefact.

The application should preserve earlier document versions and provenance.

---

## 8. GenAI provider independence

Noteboard should not be coupled to any single GenAI provider.

### 8.1 Provider abstraction

Introduce a common provider interface supporting:

- Authentication or connection configuration.
- Model discovery where available.
- Prompt submission.
- Context transmission.
- Streaming response handling.
- Cancellation.
- Error and usage-limit reporting.
- Response metadata.

Capability differences should be represented explicitly rather than assuming every provider behaves identically.

### 8.2 Candidate providers

| Provider               | Proposed connection                            |
| ---------------------- | ---------------------------------------------- |
| ChatGPT subscription   | Eligible Sign in with ChatGPT integration      |
| OpenAI API             | Independently billed API integration           |
| Ollama                 | Local inference                                |
| MLX-based servers      | Local inference through a compatible interface |
| Other hosted providers | Future provider adapters                       |

Users can select a default provider and, eventually, override it for individual Notes.

A Board may contain Notes generated by different models.

### 8.3 Billing and authentication safeguards

ChatGPT subscription inference and separately billed API inference must be distinct provider configurations.

The application should never silently switch from subscription-based usage to paid API usage.

Provider credentials must be stored securely and kept separate from exported Board data.

The exact authentication and model capabilities of each integration require technical validation.

---

## 9. Proposed technical architecture

The initial application should be local-first, with an architecture that could later support additional deployment models.

### Proposed stack

| Component               | Initial direction                                                     |
| ----------------------- | --------------------------------------------------------------------- |
| Desktop application     | Electron                                                              |
| Frontend                | React and TypeScript                                                  |
| Spatial Board           | React Flow or equivalent graph/canvas library                         |
| Rich response rendering | Markdown-based reading surface with reliable text-selection anchoring |
| Application state       | Dedicated Board and Note state management                             |
| Persistence             | SQLite                                                                |
| Provider abstraction    | TypeScript adapter interfaces                                         |
| GenAI inference         | Provider-specific authenticated connections                           |
| Synthesis editor        | Rich-text or structured document editor                               |

These are implementation proposals, not finalised or tested selections.

### Architectural components

**Board Engine**

Manages spatial positions, connections, zoom, panning, selection and navigation.

**Note Engine**

Manages prompts, response versions, Takeaways, Highlights and immutable source records.

**Context Engine**

Reconstructs ancestry, assembles model context, estimates token budgets and records effective context.

**Provider Engine**

Implements model connections, authentication, streaming and error handling.

**Synthesis Engine**

Transforms selected Notes into structured, traceable documents.

**Persistence Layer**

Stores Boards, Notes, Edges, source anchors, settings and artefacts locally.

---

## 10. Development roadmap

### Phase 1 — UX interaction prototype

**Goal:** Validate the central interaction without requiring live GenAI integration.

Deliver:

- Spatial Board with sticky Notes.
- Compact and expanded Note presentations.
- Text highlighting within responses.
- Editable prefilled child prompts.
- Highlight-labelled Edges.
- Automatic child placement.
- Pan, zoom and basic navigation.

Use synthetic example responses.

**Completion criterion:** A user can create and navigate a branching exploration using the intended UX.

### Phase 2 — Functional exploration MVP

**Goal:** Connect the interaction to actual GenAI inference.

Deliver:

- Provider abstraction.
- One working GenAI provider.
- Streaming responses.
- Ancestral context inheritance.
- Local persistence.
- Model and generation metadata.
- Error handling and response versioning.

**Completion criterion:** A user can develop a persistent, multi-level exploration with correct context inheritance.

### Phase 3 — Synthesis MVP

**Goal:** Complete the Explore → Synthesise workflow.

Deliver:

- Selection of Notes for synthesis.
- Learning journey output.
- Integrated explanation output.
- Editable document.
- Links from document sections to source Notes.
- Return-to-exploration navigation.

**Completion criterion:** A user can transform an exploration into a coherent document without losing the original Board.

### Phase 4 — Refinement and additional providers

**Goal:** Improve usability and operational flexibility.

Consider:

- Additional GenAI provider integrations.
- Adaptive summaries and semantic zoom refinement.
- Configurable branch-depth reminders.
- Context budget management.
- Continue from here.
- Import/export.
- Accessibility and keyboard workflows.
- Performance with large Boards.

### Phase 5 — Research evaluation

**Goal:** Investigate the UX's effect on human understanding.

Potential comparison: conventional linear GenAI chat versus Noteboard using comparable underlying models and learning tasks.

Potential outcomes:

- Conceptual understanding.
- Explanation accuracy.
- Knowledge retention.
- Transfer to related problems.
- Perceived cognitive load.
- Confidence calibration.
- User agency and interaction behaviour.

This phase requires its own study design and should not assume that spatial exploration necessarily improves learning.

---

## 11. Scope boundaries for the MVP

To retain focus, the initial version should exclude:

- Autonomous AI-generated mind maps.
- Automatic creation of investigative branches.
- Multi-parent Notes or hyperedges.
- Complex agent orchestration.
- Automatic repository investigation.
- Shared real-time collaborative Boards.
- Large configuration panels.
- AI-driven rearrangement of the exploration.

These features may be considered later, but none is necessary to test the core concept.

---

## 12. Outstanding design decisions

The next design iteration should resolve:

1. **Detailed Note presentation:** Expand in place, open a reading panel, or use a hybrid approach?
2. **Board layout:** How should new child Notes be automatically positioned while respecting manual arrangements?
3. **Text anchoring:** How should Highlights remain accurately linked across rich-text rendering and response versions?
4. **Takeaway generation:** Which lightweight strategy produces reliable compact summaries?
5. **Synthesis editing:** How should changes to a synthesised document interact with subsequent regeneration?
6. **Context management:** What should users see when a provider's effective context budget is reached?

These are design decisions to investigate rather than reasons to delay the first interaction prototype.

---

## 13. Initial success criteria

The first complete prototype should demonstrate that a user can:

- Ask an initial question and receive a response in a sticky Note.
- Zoom out to understand the current exploration.
- Zoom into a Note to read its complete response.
- Highlight one passage and create a child Note.
- Edit the automatically prepared `What is <Highlight>?` prompt.
- See the Highlight displayed on the connecting Edge.
- Create multiple branches and navigate between them.
- Receive responses with the correct inherited ancestral context.
- Save and reopen the exploration.
- Select Notes and synthesise them into an editable linear document.
- Navigate from synthesised content back to its originating Notes.

The prototype should also preserve the original human-authored prompts, generated responses, Highlight provenance and exploration structure.

---

## 14. Guiding design statement

**Noteboard allows people to explore knowledge spatially and synthesise understanding linearly.**

Its fundamental interaction is:

**Ask → Read → Highlight → Branch → Explore**

Its complementary process is:

**Select → Organise → Synthesise → Review**

Together, they provide a human-directed cycle of exploration, understanding and communication.

The Board captures the path of inquiry. The synthesis captures the resulting account of understanding.

Neither replaces the other.
