import { z } from "zod";
export const MessageSchema = z.object({
  role: z.enum(["system", "developer", "user", "assistant"]),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;
export const SettingsSchema = z.object({
  provider: z.enum(["demo", "ollama", "chatgpt"]),
  endpoint: z.string().max(300),
  chatgptAccountId: z.string().max(200).optional(),
  model: z.string().max(100),
  contextLimit: z.number().int().min(1024).max(1000000),
  depthReminder: z.number().int().min(1).max(100),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const defaults: Settings = {
  provider: "demo",
  endpoint: "http://127.0.0.1:11434",
  model: "",
  contextLimit: 8192,
  depthReminder: 8,
};
const PositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
export const VersionSchema = z.object({
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
export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  highlight: HighlightSchema,
});
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
  schemaVersion: z.literal(1),
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
    schemaVersion: 1,
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
  const b = BoardSchema.parse(value);
  const ids = new Set(b.notes.map((n) => n.id));
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
    const n = b.notes.find((n) => n.id === e.source)!;
    const v = n.versions.find((v) => v.id === e.highlight.versionId);
    const h = e.highlight;
    const surface = h.surface === "rendered" ? h.renderedText : v?.text;
    if (
      h.sourceId !== e.source ||
      !v ||
      !surface ||
      surface.slice(h.start, h.end) !== h.text
    )
      throw new Error("Invalid Highlight provenance");
  }
  for (const id of ids) {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current) {
      if (visited.has(current)) throw new Error("Cycles are not allowed");
      visited.add(current);
      current = parents.get(current);
    }
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
