import { z } from "zod";
import { AttachmentsSchema, WebResearchSchema } from "./research";
import {
  defaultCustomInstructions,
  MAX_CUSTOM_INSTRUCTIONS,
} from "./instructions";
export const MessageSchema = z
  .object({
    role: z.enum(["system", "developer", "user", "assistant"]),
    content: z.string(),
    files: AttachmentsSchema.optional(),
  })
  .refine(
    (message) => !message.files?.length || message.role === "user",
    "Files must belong to a user message",
  );
export type Message = z.infer<typeof MessageSchema>;
export const AppearanceSchema = z.object({
  noteStyle: z
    .enum(["classic", "sticky", "blueprint", "index", "studio"])
    .default("classic"),
  theme: z.enum(["light", "dark", "system"]).default("light"),
  accent: z.enum(["sage", "blue", "plum"]).default("sage"),
  textSize: z.enum(["standard", "large", "larger"]).default("standard"),
  showGrid: z.boolean().default(true),
  interfaceFont: z.enum(["standard", "monospace"]).default("standard"),
  readingFont: z.enum(["sans", "serif", "monospace"]).default("sans"),
});
export type Appearance = z.infer<typeof AppearanceSchema>;
export const defaultAppearance: Appearance = AppearanceSchema.parse({});
export const ReasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;
export const SettingsSchema = z.object({
  provider: z.enum(["demo", "ollama", "chatgpt"]),
  endpoint: z.string().max(300),
  chatgptAccountId: z.string().max(200).optional(),
  model: z.string().max(100),
  reasoningEffort: ReasoningEffortSchema.optional(),
  webSearch: z.boolean().optional(),
  customInstructions: z
    .string()
    .max(MAX_CUSTOM_INSTRUCTIONS)
    .default(defaultCustomInstructions),
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
  customInstructions: defaultCustomInstructions,
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
  files: AttachmentsSchema.optional(),
  webResearch: WebResearchSchema.optional(),
  reasoningEffort: ReasoningEffortSchema.optional(),
  context: z.array(MessageSchema),
  estimatedTokens: z.number(),
  prompt: z.string().min(1).max(30000).optional(),
  ancestryVersions: z.record(z.string(), z.string()).optional(),
  basedOnVersionId: z.string().optional(),
  usage: z
    .object({ input: z.number().optional(), output: z.number().optional() })
    .optional(),
});
const EditedVersionSchema = z.object({
  origin: z.literal("edited"),
  id: z.string(),
  text: z.string().min(1),
  createdAt: z.string(),
  provider: z.literal("human"),
  model: z.literal("editor"),
  files: AttachmentsSchema.optional(),
  context: z.null(),
  estimatedTokens: z.null(),
  prompt: z.string().min(1).max(30000),
  ancestryVersions: z.record(z.string(), z.string()),
  basedOnVersionId: z.string(),
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
  EditedVersionSchema,
]);
export type ResponseVersion = z.infer<typeof VersionSchema>;
export const NoteSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
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
  reasoningEffort: ReasoningEffortSchema.optional(),
  context: z.array(MessageSchema),
});
export const ArtefactSchema = z.object({
  id: z.string(),
  title: z.string(),
  format: z.enum(["journey", "explanation", "structured"]),
  noteIds: z.array(z.string()),
  sourceVersions: z.record(z.string(), z.string()),
  archivedSources: z.array(NoteSchema).optional(),
  versions: z.array(DocumentVersionSchema).min(1),
});
export type Artefact = z.infer<typeof ArtefactSchema>;
export const BoardSchema = z.object({
  schemaVersion: z.literal(4),
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
export const versionPrompt = (note: Note, version = response(note)) =>
  ("prompt" in version ? version.prompt : undefined) ?? note.prompt;
export function noteAtVersion(note: Note, versionId: string): Note {
  const version = note.versions.find((v) => v.id === versionId);
  if (!version) throw new Error("Source response version is unavailable");
  return { ...note, prompt: versionPrompt(note, version), versions: [version] };
}
export function newBoard(title = "Untitled inquiry"): Board {
  return {
    schemaVersion: 4,
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
  const previous =
    header.schemaVersion === 2 || header.schemaVersion === 3
      ? BoardSchema.extend({
          schemaVersion: z.union([z.literal(2), z.literal(3)]),
        }).parse(value)
      : undefined;
  const b = BoardSchema.parse(
    migrated
      ? {
          ...migrated,
          schemaVersion: 4,
          notes: migrated.notes.map((n) => ({
            ...n,
            versions: n.versions.map((v) => ({ ...v, origin: "generated" })),
          })),
          edges: migrated.edges.map((e) => ({ ...e, kind: "highlight" })),
        }
      : previous
        ? { ...previous, schemaVersion: 4 }
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
    if (e.kind === "continuation" && h.versionId !== n.versions[0].id)
      throw new Error(
        "Retrospective Highlights must reference the original imported response",
      );
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
  function validateVersions(note: Note, checkAncestry: boolean) {
    const seen = new Set<string>();
    const ancestors = new Set<string>();
    let parent = parents.get(note.id);
    while (parent) {
      ancestors.add(parent);
      parent = parents.get(parent);
    }
    for (const v of note.versions) {
      if (
        v.origin === "generated" &&
        v.webResearch?.citations.some(
          (citation) => citation.end > v.text.length,
        )
      )
        throw new Error("Invalid web citation range");
      if (seen.has(v.id))
        throw new Error("Duplicate response version identifiers");
      if (
        "basedOnVersionId" in v &&
        v.basedOnVersionId &&
        !seen.has(v.basedOnVersionId)
      )
        throw new Error("Invalid revision source");
      if (checkAncestry && "ancestryVersions" in v && v.ancestryVersions) {
        if (
          Object.keys(v.ancestryVersions).length !== ancestors.size ||
          Object.entries(v.ancestryVersions).some(
            ([id, version]) =>
              !ancestors.has(id) ||
              !noteById.get(id)?.versions.some((v) => v.id === version),
          )
        )
          throw new Error("Invalid ancestral response version");
      }
      seen.add(v.id);
    }
  }
  for (const note of b.notes) validateVersions(note, true);
  for (const a of b.artefacts) {
    const archived = a.archivedSources ?? [];
    if (
      new Set(archived.map((n) => n.id)).size !== archived.length ||
      archived.some((n) => ids.has(n.id) || !a.noteIds.includes(n.id))
    )
      throw new Error("Invalid archived synthesis source");
    for (const note of archived) validateVersions(note, false);
    for (const id of a.noteIds) {
      const source = noteById.get(id) ?? archived.find((n) => n.id === id);
      if (
        !source ||
        !source.versions.some((v) => v.id === a.sourceVersions[id])
      )
        throw new Error("Invalid synthesis source");
    }
  }
  return b;
}
