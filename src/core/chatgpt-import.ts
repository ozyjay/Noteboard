import { z } from "zod";
import {
  newBoard,
  now,
  uid,
  validateBoard,
  type Board,
  type Highlight,
} from "./model";
import { takeaway } from "./context";

export const MAX_EXPORT_BYTES = 50 * 1024 * 1024;
const NodeSchema = z.object({
  id: z.string().min(1),
  parent: z.string().nullable(),
  children: z.array(z.string()),
  message: z.unknown().nullable(),
});
const ConversationSchema = z.object({
  id: z.string().optional(),
  conversation_id: z.string().optional(),
  title: z.string(),
  create_time: z.number().finite().nullable().optional(),
  current_node: z.string().nullable().optional(),
  mapping: z.record(z.string(), NodeSchema),
});
type ExportNode = z.infer<typeof NodeSchema>;
export interface ImportConversation {
  id: string;
  title: string;
  createdAt?: string;
  nodes: Record<string, ExportNode>;
  pathIds: string[];
  defaultPathId?: string;
}
export interface ImportTurn {
  prompt: string;
  response: string;
  promptMessageId: string;
  responseMessageId: string;
  promptCreatedAt?: string;
  responseCreatedAt?: string;
  model: string | null;
}
export interface ImportPreview {
  turns: ImportTurn[];
  excludedInstructions: number;
}
const date = (value: unknown): string | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  const d = new Date(value * 1000);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export function parseChatGPTExport(text: string): ImportConversation[] {
  if (new TextEncoder().encode(text).byteLength > MAX_EXPORT_BYTES)
    throw new Error(
      "ChatGPT export files must be at most 50 MiB. No content was truncated.",
    );
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid JSON. Choose an extracted conversations.json file.",
    );
  }
  if (!Array.isArray(raw) || !raw.length)
    throw new Error(
      "Expected a non-empty ChatGPT conversation array; ZIP files and transcripts are not supported.",
    );
  return raw.map((value, index) => {
    // Check the mapping count before constructing the validated node record.
    const envelope = z
      .object({ mapping: z.record(z.string(), z.unknown()) })
      .safeParse(value);
    if (!envelope.success)
      throw new Error(
        `Conversation ${index + 1}: unsupported export structure.`,
      );
    if (Object.keys(envelope.data.mapping).length > 20000)
      throw new Error(
        `Conversation ${index + 1}: exceeds 20,000 mapping nodes. No content was truncated.`,
      );
    const parsed = ConversationSchema.safeParse(value);
    if (!parsed.success)
      throw new Error(
        `Conversation ${index + 1}: unsupported export mapping structure.`,
      );
    const c = parsed.data,
      id = c.conversation_id || c.id;
    if (!id || !Object.keys(c.mapping).length)
      throw new Error(
        `Conversation ${index + 1}: missing conversation identity or messages.`,
      );
    const nodes = c.mapping;
    const roots: string[] = [],
      pathIds: string[] = [];
    const expectedChildren = new Map<string, Set<string>>();
    for (const [key, node] of Object.entries(nodes)) {
      if (key !== node.id)
        throw new Error(`${c.title}: mapping node identity mismatch.`);
      if (node.parent === null) roots.push(key);
      else {
        if (!Object.hasOwn(nodes, node.parent))
          throw new Error(`${c.title}: missing parent reference.`);
        if (!expectedChildren.has(node.parent))
          expectedChildren.set(node.parent, new Set());
        expectedChildren.get(node.parent)!.add(key);
      }
      if (!node.children.length) pathIds.push(key);
    }
    for (const [key, node] of Object.entries(nodes)) {
      const expected = expectedChildren.get(key) || new Set();
      if (
        new Set(node.children).size !== node.children.length ||
        node.children.length !== expected.size ||
        node.children.some((child) => !expected.has(child))
      )
        throw new Error(`${c.title}: inconsistent child references.`);
    }
    // Linear-time parent traversal, with no recursive stack on long exports.
    const done = new Set<string>();
    for (const key of Object.keys(nodes)) {
      const seen = new Set<string>();
      let current: string | null = key;
      while (current !== null && !done.has(current)) {
        if (seen.has(current))
          throw new Error(`${c.title}: cycle in conversation mapping.`);
        seen.add(current);
        current = nodes[current].parent;
      }
      for (const visited of seen) done.add(visited);
    }
    if (roots.length !== 1 || !pathIds.length)
      throw new Error(
        `${c.title}: conversation must have one rooted message tree.`,
      );
    const result: ImportConversation = {
      id,
      title: c.title,
      createdAt: date(c.create_time),
      nodes,
      pathIds,
    };
    if (c.current_node && pathIds.includes(c.current_node)) {
      try {
        previewChatGPTPath(result, c.current_node);
        result.defaultPathId = c.current_node;
      } catch {
        /* Require an explicit supported path. */
      }
    }
    return result;
  });
}

const Message = z
  .object({
    id: z.string().min(1),
    author: z.object({ role: z.string() }),
    content: z
      .object({ content_type: z.string(), parts: z.array(z.unknown()) })
      .passthrough(),
    create_time: z.number().finite().nullable().optional(),
    status: z.string().optional(),
    end_turn: z.boolean().nullable().optional(),
    recipient: z.string().optional(),
    channel: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export function previewChatGPTPath(
  conversation: ImportConversation,
  pathId: string,
): ImportPreview {
  if (!conversation.pathIds.includes(pathId))
    throw new Error("Choose a root-to-end conversation path.");
  const path: ExportNode[] = [];
  let current: string | null = pathId;
  while (current !== null) {
    const node: ExportNode = conversation.nodes[current];
    path.push(node);
    current = node.parent;
  }
  path.reverse();
  const turns: ImportTurn[] = [];
  let pending: { text: string; id: string; createdAt?: string } | undefined;
  let excludedInstructions = 0;
  for (const node of path) {
    if (node.message === null || node.message === undefined) continue;
    const role = z
      .object({ author: z.object({ role: z.string() }) })
      .safeParse(node.message);
    if (
      role.success &&
      ["system", "developer"].includes(role.data.author.role)
    ) {
      excludedInstructions++;
      continue;
    }
    const parsed = Message.safeParse(node.message);
    if (!parsed.success)
      throw new Error(`Message ${node.id}: unsupported message structure.`);
    const m = parsed.data;
    if (!["user", "assistant"].includes(m.author.role))
      throw new Error(
        `Message ${m.id}: tool and other non-conversation messages are not supported.`,
      );
    if (
      m.content.content_type !== "text" ||
      !m.content.parts.length ||
      m.content.parts.some((p) => typeof p !== "string")
    )
      throw new Error(
        `Message ${m.id}: only text is supported; images, attachments and other content cannot be imported.`,
      );
    if (
      (m.recipient && m.recipient !== "all") ||
      (m.channel && m.channel !== "final") ||
      (m.status && m.status !== "finished_successfully") ||
      (m.author.role === "assistant" && m.end_turn === false) ||
      m.metadata?.is_visually_hidden_from_conversation === true ||
      ["attachments", "tool_calls", "tool_call_id", "asset_pointer"].some(
        (key) => {
          const v = m[key] ?? m.metadata?.[key] ?? m.content[key];
          return v != null && (!Array.isArray(v) || v.length > 0);
        },
      )
    )
      throw new Error(
        `Message ${m.id}: unfinished messages, attachments and tool activity are not supported.`,
      );
    const text = (m.content.parts as string[]).join("\n");
    if (!text.trim())
      throw new Error(
        `Message ${m.id}: empty text cannot form a complete turn.`,
      );
    if (m.author.role === "user") {
      if (pending)
        throw new Error(
          "This path has consecutive user messages rather than complete alternating turns.",
        );
      pending = { text, id: m.id, createdAt: date(m.create_time) };
    } else {
      if (!pending)
        throw new Error(
          "This path has an assistant response without a preceding user question.",
        );
      turns.push({
        prompt: pending.text,
        response: text,
        promptMessageId: pending.id,
        responseMessageId: m.id,
        promptCreatedAt: pending.createdAt,
        responseCreatedAt: date(m.create_time),
        model:
          typeof m.metadata?.model_slug === "string" &&
          m.metadata.model_slug.trim()
            ? m.metadata.model_slug
            : null,
      });
      pending = undefined;
    }
  }
  if (pending || !turns.length)
    throw new Error(
      "This path is incomplete. Choose a path ending with a complete assistant answer.",
    );
  const ids = turns.flatMap((t) => [t.promptMessageId, t.responseMessageId]);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate message identities in this path.");
  return { turns, excludedInstructions };
}

export function importChatGPTPath(
  conversation: ImportConversation,
  pathId: string,
  title: string,
): Board {
  const { turns } = previewChatGPTPath(conversation, pathId);
  const board = newBoard(title.trim());
  const importedAt = now();
  for (const [index, turn] of turns.entries()) {
    const note = {
      id: uid(),
      prompt: turn.prompt,
      takeaway: takeaway(turn.response),
      position: { x: 80 + index * 390, y: 160 },
      createdAt: turn.promptCreatedAt || importedAt,
      versions: [
        {
          origin: "imported" as const,
          id: uid(),
          text: turn.response,
          createdAt: turn.responseCreatedAt || importedAt,
          provider: "chatgpt" as const,
          model: turn.model,
          context: null,
          estimatedTokens: null,
          provenance: {
            source: "chatgpt-export" as const,
            conversationId: conversation.id,
            promptMessageId: turn.promptMessageId,
            responseMessageId: turn.responseMessageId,
            promptCreatedAt: turn.promptCreatedAt,
            responseCreatedAt: turn.responseCreatedAt,
            importedAt,
          },
        },
      ],
    };
    const previous = board.notes.at(-1);
    board.notes.push(note);
    if (previous)
      board.edges.push({
        kind: "continuation",
        id: uid(),
        source: previous.id,
        target: note.id,
        sourceMessageId: turns[index - 1].responseMessageId,
        targetMessageId: turn.promptMessageId,
      });
  }
  return validateBoard(board);
}

export function annotateContinuation(
  board: Board,
  edgeId: string,
  highlight?: Highlight,
): Board {
  const edge = board.edges.find((e) => e.id === edgeId);
  if (!edge || edge.kind !== "continuation")
    throw new Error("Choose an imported continuation.");
  return validateBoard({
    ...board,
    edges: board.edges.map((e) => (e.id === edgeId ? { ...e, highlight } : e)),
    updatedAt: now(),
  });
}
