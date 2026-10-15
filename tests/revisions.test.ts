import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { exampleBoard } from "../src/core/example";
import {
  type Board,
  type Note,
  type ResponseVersion,
  now,
  uid,
  response,
  versionPrompt,
  noteAtVersion,
  validateBoard,
} from "../src/core/model";
import { appendRevision } from "../src/core/revisions";
import {
  buildContext,
  pathVersions,
  revisionContext,
  versionPath,
} from "../src/core/context";
import { journey, synthesisContext } from "../src/core/synthesis";
import { Store } from "../electron/store";
import {
  importChatGPTPath,
  parseChatGPTExport,
} from "../src/core/chatgpt-import";
import { chatGPTExportFixture } from "./fixtures/chatgpt-export";

function edited(
  board: Board,
  note: Note,
  text: string,
): Extract<ResponseVersion, { origin: "edited" }> {
  return {
    id: uid(),
    origin: "edited",
    text,
    createdAt: now(),
    provider: "human",
    model: "editor",
    context: null,
    estimatedTokens: null,
    prompt: versionPrompt(note),
    basedOnVersionId: response(note).id,
    ancestryVersions: revisionContext(
      board,
      note.id,
      response(note).id,
      versionPrompt(note),
      "",
    ).ancestryVersions,
  };
}

it("pins distant ancestors and isolates siblings after parent and root revisions", () => {
  let board = exampleBoard();
  const original = structuredClone(board);
  const root = board.notes[0];
  const child = board.notes[1];
  board = appendRevision(
    board,
    root.id,
    edited(board, root, "Revised root response"),
  );
  const revisedPrompt = "A clearer child question";
  const request = revisionContext(
    board,
    child.id,
    response(child).id,
    revisedPrompt,
    "New preferences",
  );
  expect(request.messages.some((m) => m.content === response(root).text)).toBe(
    true,
  );
  expect(
    request.messages.some((m) => m.content === "Revised root response"),
  ).toBe(false);
  expect(
    request.messages.some((m) => m.content === original.notes[2].prompt),
  ).toBe(false);
  const newChild: ResponseVersion = {
    ...edited(board, child, "A revised child answer"),
    prompt: revisedPrompt,
  };
  board = appendRevision(board, child.id, newChild);
  const h = {
    sourceId: child.id,
    versionId: newChild.id,
    text: "revised",
    start: 2,
    end: 9,
    surface: "markdown" as const,
  };
  const context = buildContext(board, "Next question", h, "");
  expect(context.map((m) => m.content)).toContain(revisedPrompt);
  expect(context.map((m) => m.content)).toContain(response(root).text);
  expect(context.map((m) => m.content)).not.toContain("Revised root response");
  expect(pathVersions(board, child.id, newChild.id)).toEqual({
    [root.id]: response(root).id,
    [child.id]: newChild.id,
  });
  expect(board.notes[0].versions[0]).toEqual(root.versions[0]);
  expect(board.notes[1].prompt).toBe(child.prompt);
  expect(board.edges).toEqual(original.edges);
  expect(noteAtVersion(board.notes[1], newChild.id).prompt).toBe(revisedPrompt);
});

it("keeps imported chronology and unknown metadata when originals acquire revisions", () => {
  const conversation = parseChatGPTExport(
    JSON.stringify(chatGPTExportFixture),
  )[0];
  let board = importChatGPTPath(conversation, "a2", "Imported");
  const original = structuredClone(board);
  const root = board.notes[0];
  board = appendRevision(
    board,
    root.id,
    edited(board, root, "Human correction"),
  );
  const child = board.notes[1];
  expect(versionPath(board, child.id, response(child).id)[0].version).toEqual(
    root.versions[0],
  );
  expect(
    revisionContext(
      board,
      child.id,
      response(child).id,
      "New question",
      "",
    ).messages.map((m) => m.content),
  ).not.toContain("Human correction");
  expect(board.notes.map((n) => n.versions[0])).toEqual(
    original.notes.map((n) => n.versions[0]),
  );
  expect(board.notes[0].versions[0].context).toBeNull();
  expect(board.edges).toEqual(original.edges);
});

it("reopens prompt revisions, human edits and synthesis references without changing history", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-revisions-"));
  try {
    let board = exampleBoard();
    const root = board.notes[0];
    const originalVersion = response(root).id;
    board.artefacts.push({
      id: uid(),
      title: "Original journey",
      format: "journey",
      noteIds: [root.id],
      sourceVersions: { [root.id]: originalVersion },
      versions: [
        {
          id: uid(),
          text: journey(board, [root.id]),
          createdAt: now(),
          kind: "generated",
          provider: "human",
          model: "verbatim",
          context: [],
        },
      ],
    });
    const originalArtefacts = structuredClone(board.artefacts);
    const generated: ResponseVersion = {
      id: uid(),
      origin: "generated",
      prompt: "A revised root question",
      text: "A new synthetic answer",
      createdAt: now(),
      provider: "demo",
      model: "synthetic-demo",
      context: buildContext(board, "A revised root question", undefined, ""),
      estimatedTokens: 20,
      ancestryVersions: {},
      basedOnVersionId: originalVersion,
    };
    board = appendRevision(board, root.id, generated);
    board = appendRevision(
      board,
      root.id,
      edited(board, board.notes[0], "A human correction with $x^2$"),
    );
    expect(journey(board, [root.id])).toContain("Human-edited response");
    expect(journey(board, [root.id])).toContain("A revised root question");
    expect(
      synthesisContext(board, [root.id], "explanation", "")[1].content,
    ).toContain("[Human-edited response]");
    expect(board.artefacts).toEqual(originalArtefacts);
    let store = new Store(path.join(dir, "test.sqlite"));
    store.save(board);
    store.close();
    store = new Store(path.join(dir, "test.sqlite"));
    expect(store.list()).toEqual([board]);
    store.close();
    expect(noteAtVersion(board.notes[0], originalVersion).versions[0]).toEqual(
      root.versions[0],
    );
    expect(
      validateBoard({ ...exampleBoard(), schemaVersion: 2 }).schemaVersion,
    ).toBe(3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("rejects duplicate versions, missing revision bases and invalid ancestry pins", () => {
  const board = exampleBoard();
  const root = board.notes[0];
  expect(() => appendRevision(board, root.id, response(root))).toThrow(
    /Duplicate response version/,
  );
  expect(() =>
    appendRevision(board, root.id, {
      ...edited(board, root, "Text"),
      basedOnVersionId: "missing",
    }),
  ).toThrow(/Invalid revision source/);
  expect(() =>
    appendRevision(board, board.notes[1].id, {
      ...edited(board, board.notes[1], "Text"),
      ancestryVersions: {},
    }),
  ).toThrow(/Invalid ancestral/);
});

it("retains recorded Highlight framing after retrospective annotations change", () => {
  const conversation = parseChatGPTExport(
    JSON.stringify(chatGPTExportFixture),
  )[0];
  let board = importChatGPTPath(conversation, "a2", "Imported");
  const root = board.notes[0];
  const child = board.notes[1];
  const text = response(root).text.slice(0, 5);
  board.edges[0].highlight = {
    sourceId: root.id,
    versionId: response(root).id,
    text,
    start: 0,
    end: 5,
    surface: "markdown",
  };
  const request = revisionContext(
    board,
    child.id,
    response(child).id,
    "A new question",
    "",
  );
  const generated: ResponseVersion = {
    id: uid(),
    origin: "generated",
    createdAt: now(),
    text: "New answer",
    prompt: "A new question",
    provider: "demo",
    model: "synthetic-demo",
    context: request.messages,
    estimatedTokens: 50,
    ancestryVersions: request.ancestryVersions,
    basedOnVersionId: response(child).id,
  };
  board = appendRevision(board, child.id, generated);
  board = appendRevision(
    board,
    child.id,
    edited(board, board.notes[1], "Human reviewed answer"),
  );
  board.edges[0].highlight = undefined;
  const next = revisionContext(
    board,
    child.id,
    response(board.notes[1]).id,
    "Another question",
    "",
  );
  expect(next.messages.at(-1)!.content).toBe(
    request.messages
      .at(-1)!
      .content.replace(/A new question$/, "Another question"),
  );
  const amendedRoot = edited(board, board.notes[0], "Replacement source");
  board = appendRevision(board, root.id, amendedRoot);
  board.edges[0].highlight = {
    sourceId: root.id,
    versionId: amendedRoot.id,
    text: "Replacement",
    start: 0,
    end: 11,
    surface: "markdown",
  };
  expect(() => validateBoard(board)).toThrow(/original imported response/);
});
