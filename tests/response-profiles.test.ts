import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../electron/store";
import { buildContext, revisionContext } from "../src/core/context";
import { exampleBoard } from "../src/core/example";
import { newBoard, validateBoard } from "../src/core/model";
import {
  boardProfile,
  profileInstructions,
  responseProfiles,
} from "../src/core/response-profiles";

it("defaults new Boards to Explore and preserves legacy custom preferences", () => {
  expect(boardProfile(newBoard())).toBe("explore");
  const { responseProfile: _, ...legacy } = exampleBoard();
  expect(boardProfile(validateBoard(legacy))).toBe("custom");
  expect(profileInstructions("custom", "My exact instructions\n")).toBe(
    "My exact instructions\n",
  );
  expect(profileInstructions("custom", "")).toBe("");
  expect(() =>
    validateBoard({ ...legacy, responseProfile: "unknown" }),
  ).toThrow();
});

it.each(["explore", "direct", "evaluate"] as const)(
  "records %s instructions without mixing in legacy custom text or siblings",
  (profile) => {
    const board = exampleBoard();
    const highlight = board.edges[0].highlight!;
    const instructions = profileInstructions(
      profile,
      "Always use my old report headings",
    );
    const context = buildContext(
      board,
      "Explain this",
      highlight,
      instructions,
    );
    expect(context[0].content).toContain(
      `# Response profile: ${responseProfiles[profile].label}`,
    );
    expect(context[0].content).toContain("Australian English");
    expect(context[0].content).not.toContain(
      "Always use my old report headings",
    );
    expect(context[0].content).toContain(
      "Do not create investigative branches",
    );
    expect(context.at(-1)!.content).toContain(highlight.text);
    expect(JSON.stringify(context)).not.toContain(
      board.notes[2].versions[0].text,
    );
    const revision = revisionContext(
      board,
      board.notes[1].id,
      board.notes[1].versions[0].id,
      "Revised",
      instructions,
    );
    expect(revision.messages[0]).toEqual(context[0]);
  },
);

it("round-trips Board profiles and immutable effective instructions through SQLite and exported JSON", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "noteboard-profiles-"));
  const filename = path.join(dir, "profiles.sqlite");
  let store: Store | undefined;
  try {
    store = new Store(filename);
    const board = exampleBoard();
    board.responseProfile = "evaluate";
    const oldVersions = structuredClone(board.notes);
    store.save(board);
    store.close();
    store = new Store(filename);
    const reopened = store.list()[0];
    expect(reopened.responseProfile).toBe("evaluate");
    expect(reopened.notes).toEqual(oldVersions);
    expect(validateBoard(JSON.parse(JSON.stringify(reopened)))).toEqual(board);
  } finally {
    store?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
