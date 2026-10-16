import { describe, expect, it } from "vitest";
import { chatGPTExportFixture as fixture } from "./fixtures/chatgpt-export";
import {
  annotateContinuation,
  importChatGPTPath,
  MAX_EXPORT_BYTES,
  parseChatGPTExport,
  previewChatGPTPath,
} from "../src/core/chatgpt-import";
import { assertBudget, buildContext } from "../src/core/context";
import { exampleBoard } from "../src/core/example";
import { response, validateBoard } from "../src/core/model";
import {
  journey,
  selectMaterial,
  synthesisContext,
} from "../src/core/synthesis";

const load = () => parseChatGPTExport(JSON.stringify(fixture))[0];
const imported = () =>
  importChatGPTPath(load(), "a2", "Imported café conversation");
const mutate = (fn: (c: (typeof fixture)[0]) => void) => {
  const data = structuredClone(fixture);
  fn(data[0]);
  return JSON.stringify(data);
};
describe("ChatGPT text import", () => {
  it("preserves the chosen text path, identities and metadata without reconstructing inference", () => {
    const c = load();
    expect(c.pathIds).toEqual(["a2", "a2-alt"]);
    expect(c.defaultPathId).toBe("a2");
    const p = previewChatGPTPath(c, "a2");
    expect(p.excludedInstructions).toBe(1);
    const board = imported();
    expect(board.schemaVersion).toBe(4);
    expect(board.notes.map((n) => [n.prompt, response(n).text])).toEqual(
      p.turns.map((t) => [t.prompt, t.response]),
    );
    expect(board.notes[1].position.x - board.notes[0].position.x).toBe(390);
    expect(response(board.notes[0])).toMatchObject({
      origin: "imported",
      provider: "chatgpt",
      model: "exported-model",
      context: null,
      estimatedTokens: null,
      provenance: {
        conversationId: c.id,
        promptMessageId: "u1",
        responseMessageId: "a1",
        responseCreatedAt: "2023-11-14T22:13:20.000Z",
      },
    });
    expect(response(board.notes[1]).model).toBeNull();
    expect(board.edges[0]).toMatchObject({
      kind: "continuation",
      sourceMessageId: "a1",
      targetMessageId: "u2",
    });
    expect(JSON.stringify(board)).not.toContain(
      "Original private instructions",
    );
    expect(JSON.stringify(board)).not.toContain("Explain the equation instead");
    expect(imported().id).not.toBe(board.id);
    const alternative = importChatGPTPath(c, "a2-alt", "Alternative");
    expect(alternative.notes[1].prompt).toBe("Explain the equation instead");
  });
  it("joins string parts with newlines and retains missing source dates as unknown", () => {
    const text = mutate((c) => {
      const m = c.mapping.a1.message!;
      m.content.parts = [" untrimmed ", "\\[x^2\\]"];
      delete (m as { create_time?: number }).create_time;
    });
    const c = parseChatGPTExport(text)[0];
    const b = importChatGPTPath(c, "a2", "Parts");
    const v = response(b.notes[0]);
    expect(v.text).toBe(" untrimmed \n\\[x^2\\]");
    expect(
      v.origin === "imported" && v.provenance.responseCreatedAt,
    ).toBeUndefined();
  });
  it("rejects invalid structure, missing references, cycles and oversized inputs", () => {
    expect(() => parseChatGPTExport("not json")).toThrow(/Invalid JSON/);
    expect(() => parseChatGPTExport("{}")).toThrow(/array/);
    expect(() =>
      parseChatGPTExport(
        mutate((c) => {
          c.mapping.a2.parent = "missing";
        }),
      ),
    ).toThrow(/parent reference/);
    expect(() =>
      parseChatGPTExport(
        mutate((c) => {
          c.mapping.a2.children = ["missing"];
        }),
      ),
    ).toThrow(/child references/);
    expect(() =>
      parseChatGPTExport(
        mutate((c) => {
          c.mapping.root.parent = "a2";
          c.mapping.a2.children = ["root"];
        }),
      ),
    ).toThrow(/cycle/);
    expect(() => parseChatGPTExport(" ".repeat(MAX_EXPORT_BYTES + 1))).toThrow(
      /50 MiB/,
    );
    expect(() =>
      parseChatGPTExport(
        JSON.stringify([
          {
            mapping: Object.fromEntries(
              Array.from({ length: 20001 }, (_, i) => [i, null]),
            ),
          },
        ]),
      ),
    ).toThrow(/20,000/);
  });
  it("rejects unsupported content and incomplete turns without defaulting to an invalid path", () => {
    for (const change of [
      (c: (typeof fixture)[0]) => {
        c.mapping.a2.message!.author.role = "tool";
      },
      (c: (typeof fixture)[0]) => {
        c.mapping.a2.message!.content.content_type = "multimodal_text";
      },
      (c: (typeof fixture)[0]) => {
        c.mapping.a2.message!.status = "in_progress";
      },
      (c: (typeof fixture)[0]) => {
        c.mapping.a2.message!.metadata = {
          is_visually_hidden_from_conversation: true,
        };
      },
      (c: (typeof fixture)[0]) => {
        c.mapping.a2.message!.author.role = "user";
      },
      (c: (typeof fixture)[0]) => {
        (c.mapping.a2.message as unknown as { metadata: unknown }).metadata = {
          attachments: [{ id: "file" }],
        };
      },
    ]) {
      const c = parseChatGPTExport(mutate(change))[0];
      expect(c.defaultPathId).toBeUndefined();
      expect(() => importChatGPTPath(c, "a2", "Unsupported")).toThrow();
      expect(previewChatGPTPath(c, "a2-alt").turns).toHaveLength(2);
    }
    const c = parseChatGPTExport(
      mutate((c) => {
        c.mapping.u2.children = [];
        delete c.mapping.a2;
      }),
    )[0];
    expect(() => previewChatGPTPath(c, "u2")).toThrow(/incomplete/);
  });
  it("attaches, replaces and removes exact retrospective anchors without changing messages or ancestry", () => {
    const b = imported(),
      before = structuredClone(b.notes),
      v = response(b.notes[0]);
    const h = {
      sourceId: b.notes[0].id,
      versionId: v.id,
      text: "term",
      start: 17,
      end: 21,
      surface: "markdown" as const,
    };
    expect(v.text.slice(h.start, h.end)).toBe("term");
    const anchored = annotateContinuation(b, b.edges[0].id, h);
    expect(anchored.notes).toEqual(before);
    expect(anchored.edges[0].kind).toBe("continuation");
    const replaced = annotateContinuation(anchored, b.edges[0].id, {
      ...h,
      start: 6,
      end: 10,
    });
    expect(replaced.edges[0].highlight!.start).toBe(6);
    expect(
      annotateContinuation(replaced, b.edges[0].id).edges[0].highlight,
    ).toBeUndefined();
    expect(() =>
      annotateContinuation(b, b.edges[0].id, { ...h, start: 0 }),
    ).toThrow(/provenance/);
    const source = b.notes[1],
      sourceVersion = response(source);
    const context = buildContext(anchored, "New question", {
      sourceId: source.id,
      versionId: sourceVersion.id,
      text: "second",
      start: 10,
      end: 16,
      surface: "markdown",
    });
    expect(context.slice(1, 5)).toEqual([
      { role: "user", content: b.notes[0].prompt },
      { role: "assistant", content: v.text },
      { role: "user", content: source.prompt },
      { role: "assistant", content: sourceVersion.text },
    ]);
    expect(context.at(-1)!.content).toContain("New question");
    expect(context.map((m) => m.content).join("\n")).not.toContain(
      "Explain the equation instead",
    );
    expect(() =>
      assertBudget([{ role: "user", content: v.text.repeat(400) }], 1024),
    ).toThrow(/No history/);
    expect(selectMaterial(anchored, "branch", [source.id])).toEqual(
      b.notes.map((n) => n.id),
    );
    expect(
      journey(
        anchored,
        b.notes.map((n) => n.id),
      ),
    ).toContain("Retrospective Highlight");
    expect(
      synthesisContext(
        anchored,
        b.notes.map((n) => n.id),
        "explanation",
        "",
      )[1].content,
    ).toContain(v.text);
    expect(validateBoard(JSON.parse(JSON.stringify(anchored)))).toEqual(
      anchored,
    );
  });
  it("migrates v1 deterministically and preserves generated records and artefacts", () => {
    const b = exampleBoard();
    b.artefacts.push({
      id: "legacy-document",
      title: "Original journey",
      format: "journey",
      noteIds: [b.notes[0].id],
      sourceVersions: { [b.notes[0].id]: response(b.notes[0]).id },
      versions: [
        {
          id: "original-document",
          text: journey(b, [b.notes[0].id]),
          createdAt: b.createdAt,
          kind: "generated",
          provider: "human",
          model: "verbatim",
          context: [],
        },
        {
          id: "edited-document",
          text: "Original edited revision",
          createdAt: b.createdAt,
          kind: "edited",
          provider: "human",
          model: "editor",
          context: [],
        },
      ],
    });
    const legacy = {
      ...b,
      schemaVersion: 1,
      notes: b.notes.map((n) => ({
        ...n,
        versions: n.versions.map(({ origin: _origin, ...v }) => v),
      })),
      edges: b.edges.map(({ kind: _kind, ...e }) => e),
    };
    expect(validateBoard(legacy)).toEqual(b);
    expect(validateBoard(legacy)).toEqual(validateBoard(legacy));
    const invalid = {
      ...legacy,
      edges: legacy.edges.map(({ highlight: _h, ...e }) => e),
    };
    expect(() => validateBoard(invalid)).toThrow();
  });
});
