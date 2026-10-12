import { z } from "zod";
export const MessageSchema = z.object({
  role: z.enum(["system", "developer", "user", "assistant"]),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;
export const AppearanceSchema = z.object({
  noteStyle: z.enum(["classic", "sticky"]).default("classic"),
  theme: z.enum(["light", "dark", "system"]).default("light"),
  accent: z.enum(["sage", "blue", "plum"]).default("sage"),
  textSize: z.enum(["standard", "large", "larger"]).default("standard"),
  showGrid: z.boolean().default(true),
  interfaceFont: z.enum(["standard", "monospace"]).default("standard"),
  readingFont: z.enum(["sans", "serif", "monospace"]).default("sans"),
});
export type Appearance = z.infer<typeof AppearanceSchema>;
export const defaultAppearance: Appearance = AppearanceSchema.parse({});
export const SettingsSchema = z.object({
  provider: z.enum(["demo", "ollama", "chatgpt"]),
  endpoint: z.string().max(300),
  chatgptAccountId: z.string().max(200).optional(),
  model: z.string().max(100),
  contextLimit: z.number().int().min(1024).max(1000000),
  appearance: AppearanceSchema.default(defaultAppearance),
  depthReminder: z.number().int().min(1).max(100),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const defaults: Settings = {
  provider: "demo",
  endpoint: "http://127.0.0.1:11434",
  model: "",
  contextLimit: 8192,
  depthReminder: 8,
  appearance: defaultAppearance,
};
const PositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
const GeneratedVersionSchema = z.object({
  origin: z.literal("generated"),
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  provider: z.enum(["demo", "ollama", "chatgpt"]),
  model: z.string(),
  context: z.array(MessageSchema),
  estimatedTokens: z.number(),
  usage: z
    .object({ input: z.number().optional(), output: z.number().optional() })
    .optional(),
});
export const ImportedVersionSchema = z.object({
  origin: z.literal("imported"),
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  provider: z.literal("chatgpt"),
  model: z.string().nullable(),
  context: z.null(),
  estimatedTokens: z.null(),
  provenance: z.object({
    source: z.literal("chatgpt-export"),
    conversationId: z.string().min(1),
    promptMessageId: z.string().min(1),
    responseMessageId: z.string().min(1),
    promptCreatedAt: z.string().optional(),
    responseCreatedAt: z.string().optional(),
    importedAt: z.string(),
  }),
});
export const VersionSchema = z.discriminatedUnion("origin", [
  GeneratedVersionSchema,
  ImportedVersionSchema,
]);
export type ResponseVersion = z.infer<typeof VersionSchema>;
export const NoteSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  takeaway: z.string(),
  position: PositionSchema,
  versions: z.array(VersionSchema).min(1),
  createdAt: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;
export const HighlightSchema = z.object({
  sourceId: z.string(),
  versionId: z.string(),
  text: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  surface: z.enum(["markdown", "rendered"]),
  renderedText: z.string().optional(),
  renderedMath: z.boolean().optional(),
  latexSources: z.array(z.string()).optional(),
  displayText: z.string().optional(),
});
export type Highlight = z.infer<typeof HighlightSchema>;
export const highlightLabel = (highlight: Highlight) =>
  highlight.displayText ?? highlight.text;
const BranchEdgeSchema = z.object({
  kind: z.literal("highlight"),
  id: z.string(),
  source: z.string(),
  target: z.string(),
  highlight: HighlightSchema,
});
export const ContinuationEdgeSchema = z.object({
  kind: z.literal("continuation"),
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceMessageId: z.string().min(1),
  targetMessageId: z.string().min(1),
  highlight: HighlightSchema.optional(),
});
export const EdgeSchema = z.discriminatedUnion("kind", [
  BranchEdgeSchema,
  ContinuationEdgeSchema,
]);
export const edgeLabel = (edge: z.infer<typeof EdgeSchema>) =>
  edge.kind === "continuation"
    ? edge.highlight
      ? "Retrospective Highlight: " + highlightLabel(edge.highlight)
      : "Imported continuation"
    : highlightLabel(edge.highlight);
export type InquiryEdge = z.infer<typeof EdgeSchema>;
export const DocumentVersionSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  kind: z.enum(["generated", "edited"]),
  provider: z.enum(["demo", "ollama", "chatgpt", "human"]),
  model: z.string(),
  context: z.array(MessageSchema),
});
export const ArtefactSchema = z.object({
  id: z.string(),
  title: z.string(),
  format: z.enum(["journey", "explanation", "structured"]),
  noteIds: z.array(z.string()),
  sourceVersions: z.record(z.string(), z.string()),
  versions: z.array(DocumentVersionSchema).min(1),
});
export type Artefact = z.infer<typeof ArtefactSchema>;
export const BoardSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string(),
  title: z.string().min(1).max(200),
  createdAt: z.string(),
  updatedAt: z.string(),
  notes: z.array(NoteSchema),
  edges: z.array(EdgeSchema),
  artefacts: z.array(ArtefactSchema),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number().min(0.1).max(2) })
    .optional(),
});
export type Board = z.infer<typeof BoardSchema>;
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const response = (note: Note) => note.versions[note.versions.length - 1];
export function newBoard(title = "Untitled inquiry"): Board {
  return {
    schemaVersion: 2,
    id: uid(),
    title,
    createdAt: now(),
    updatedAt: now(),
    notes: [],
    edges: [],
    artefacts: [],
  };
}
export function validateBoard(value: unknown): Board {
  // Legacy records are validated before adding discriminators; no IDs or anchors change.
  const legacy = BoardSchema.extend({
    schemaVersion: z.literal(1),
    notes: z.array(
      NoteSchema.extend({
        versions: z.array(GeneratedVersionSchema.omit({ origin: true })).min(1),
      }),
    ),
    edges: z.array(BranchEdgeSchema.omit({ kind: true })),
  });
  const header = z.object({ schemaVersion: z.number() }).parse(value);
  const migrated = header.schemaVersion === 1 ? legacy.parse(value) : undefined;
  const b = BoardSchema.parse(
    migrated
      ? {
          ...migrated,
          schemaVersion: 2,
          notes: migrated.notes.map((n) => ({
            ...n,
            versions: n.versions.map((v) => ({ ...v, origin: "generated" })),
          })),
          edges: migrated.edges.map((e) => ({ ...e, kind: "highlight" })),
        }
      : value,
  );
  const noteById = new Map(b.notes.map((n) => [n.id, n]));
  const ids = new Set(noteById.keys());
  if (ids.size !== b.notes.length)
    throw new Error("Duplicate Note identifiers");
  if (
    new Set(b.edges.map((e) => e.id)).size !== b.edges.length ||
    new Set(b.artefacts.map((a) => a.id)).size !== b.artefacts.length
  )
    throw new Error("Duplicate record identifiers");
  const parents = new Map<string, string>();
  for (const e of b.edges) {
    if (
      !ids.has(e.source) ||
      !ids.has(e.target) ||
      e.source === e.target ||
      parents.has(e.target)
    )
      throw new Error("Each child must have one existing parent");
    parents.set(e.target, e.source);
    const n = noteById.get(e.source)!;
    if (e.kind === "continuation") {
      const target = noteById.get(e.target)!;
      const from = n.versions[0];
      const to = target.versions[0];
      if (
        from.origin !== "imported" ||
        to.origin !== "imported" ||
        from.provenance.conversationId !== to.provenance.conversationId ||
        from.provenance.responseMessageId !== e.sourceMessageId ||
        to.provenance.promptMessageId !== e.targetMessageId
      )
        throw new Error("Invalid imported continuation provenance");
    }
    const h = e.highlight;
    if (!h) continue;
    const v = n.versions.find((v) => v.id === h.versionId);
    const surface = h.surface === "rendered" ? h.renderedText : v?.text;
    if (
      h.sourceId !== e.source ||
      !v ||
      !surface ||
      surface.slice(h.start, h.end) !== h.text
    )
      throw new Error("Invalid Highlight provenance");
  }
  const completed = new Set<string>();
  for (const id of ids) {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current && !completed.has(current)) {
      if (visited.has(current)) throw new Error("Cycles are not allowed");
      visited.add(current);
      current = parents.get(current);
    }
    for (const id of visited) completed.add(id);
  }
  if (b.notes.length && b.notes.length - b.edges.length !== 1)
    throw new Error("A Board must contain one rooted tree");
  for (const a of b.artefacts)
    for (const id of a.noteIds) {
      if (
        !ids.has(id) ||
        !b.notes
          .find((n) => n.id === id)!
          .versions.some((v) => v.id === a.sourceVersions[id])
      )
        throw new Error("Invalid synthesis source");
    }
  return b;
}
