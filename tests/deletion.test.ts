import { expect, it } from "vitest";
import { exampleBoard } from "../src/core/example";
import { deleteNote, subtreeIds } from "../src/core/deletion";
import { validateBoard, response, uid, now } from "../src/core/model";
import { buildContext } from "../src/core/context";

it("deletes a subtree without reparenting siblings or mutating source records", () => {
  const board = exampleBoard();
  const before = structuredClone(board);
  const child = board.notes[1];
  const grandchild = { ...structuredClone(child), id: uid() };
  board.notes.push(grandchild);
  board.edges.push({
    kind: "highlight",
    id: uid(),
    source: child.id,
    target: grandchild.id,
    highlight: {
      sourceId: child.id,
      versionId: response(child).id,
      text: response(child).text.slice(0, 5),
      start: 0,
      end: 5,
      surface: "markdown",
    },
  });
  const withGrandchild = structuredClone(board);
  const ids = subtreeIds(board, child.id);
  const result = deleteNote(board, child.id);
  expect(result.notes.map((n) => n.id)).toEqual(
    board.notes.filter((n) => !ids.has(n.id)).map((n) => n.id),
  );
  expect(ids.size).toBe(2);
  expect(result.edges).toEqual(board.edges.filter((e) => !ids.has(e.target)));
  expect(result.notes).toHaveLength(2);
  expect(board).toEqual(withGrandchild);
  expect(result.notes).toEqual(before.notes.filter((n) => n.id !== child.id));
  expect(validateBoard(result)).toEqual(result);
  expect(deleteNote(board, board.notes[0].id).notes).toEqual([]);
  expect(() => deleteNote(board, "missing")).toThrow(/not in this Board/);
  const siblingEdge = result.edges[0];
  const context = buildContext(result, "Continue", siblingEdge.highlight);
  expect(context.some((m) => m.content === child.prompt)).toBe(false);
});

it("preserves synthesis revisions and exact source versions after deleting the root", () => {
  const board = exampleBoard();
  const source = board.notes[1];
  board.artefacts.push({
    id: uid(),
    title: "Journey",
    format: "journey",
    noteIds: [source.id],
    sourceVersions: { [source.id]: response(source).id },
    versions: [
      {
        id: uid(),
        text: "Original document",
        createdAt: now(),
        kind: "generated",
        provider: "human",
        model: "verbatim",
        context: [],
      },
    ],
  });
  const result = deleteNote(board, board.notes[0].id);
  expect(result.notes).toEqual([]);
  expect(result.edges).toEqual([]);
  expect(result.artefacts[0]).toEqual({
    ...board.artefacts[0],
    archivedSources: [source],
  });
  expect(validateBoard(JSON.parse(JSON.stringify(result)))).toEqual(result);
  result.artefacts[0].archivedSources![0].versions[0].id = "wrong-version";
  expect(() => validateBoard(result)).toThrow(/Invalid synthesis source/);
});
