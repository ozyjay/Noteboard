import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../electron/store";
import { exampleBoard } from "../src/core/example";
import { defaults, uid, now, response } from "../src/core/model";
import { chatGPTExportFixture as fixture } from "./fixtures/chatgpt-export";
import {
  annotateContinuation,
  importChatGPTPath,
  parseChatGPTExport,
} from "../src/core/chatgpt-import";
import { DatabaseSync } from "node:sqlite";

it("reopens imported chains and migrates existing v1 JSON without replacing identities", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-import-"));
  const db = path.join(dir, "test.sqlite");
  try {
    let store = new Store(db);
    const original = exampleBoard();
    const old = {
      ...original,
      schemaVersion: 1,
      notes: original.notes.map((n) => ({
        ...n,
        versions: n.versions.map(({ origin: _o, ...v }) => v),
      })),
      edges: original.edges.map(({ kind: _k, ...e }) => e),
    };
    store.close();
    const sql = new DatabaseSync(db);
    sql
      .prepare("INSERT INTO boards VALUES (?, ?, ?, ?)")
      .run(old.id, old.title, old.updatedAt, JSON.stringify(old));
    sql.close();
    store = new Store(db);
    expect(store.list()).toEqual([original]);
    const c = parseChatGPTExport(JSON.stringify(fixture))[0];
    let b = importChatGPTPath(c, "a2", "Imported");
    const v = response(b.notes[0]);
    b = annotateContinuation(b, b.edges[0].id, {
      sourceId: b.notes[0].id,
      versionId: v.id,
      text: "term",
      start: 17,
      end: 21,
      surface: "markdown",
    });
    b.notes[1].position = { x: 910, y: 350 };
    store.save(b);
    store.close();
    store = new Store(db);
    expect(store.list().find((item) => item.id === b.id)).toEqual(b);
    expect(store.list().find((item) => item.id === original.id)).toEqual(
      original,
    );
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("reopens SQLite with spatial positions, exact anchors, effective context and document history", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-test-"));
  const db = path.join(dir, "test.sqlite");
  try {
    const b = exampleBoard();
    b.notes[0].position = { x: 123, y: 456 };
    b.notes[0].title = "Systems overview";
    b.artefacts.push({
      id: uid(),
      title: "Study notes",
      format: "journey",
      noteIds: [b.notes[0].id],
      sourceVersions: { [b.notes[0].id]: response(b.notes[0]).id },
      versions: [
        {
          id: uid(),
          text: "Draft",
          createdAt: now(),
          kind: "generated",
          provider: "human",
          model: "verbatim",
          context: [],
        },
        {
          id: uid(),
          text: "Edited",
          createdAt: now(),
          kind: "edited",
          provider: "human",
          model: "editor",
          context: [],
        },
      ],
    });
    let store = new Store(db);
    store.save(b);
    store.saveSettings({
      ...defaults,
      provider: "ollama",
      model: "local-test",
      reasoningEffort: "high",
      customInstructions: "Lead with the answer.\nKeep uncertainty visible.",
      appearance: {
        noteStyle: "sticky",
        theme: "dark",
        accent: "blue",
        textSize: "large",
        showGrid: false,
        interfaceFont: "monospace",
        readingFont: "serif",
      },
    });
    store.close();
    store = new Store(db);
    expect(store.list()).toEqual([b]);
    expect(store.settings().appearance).toEqual({
      noteStyle: "sticky",
      theme: "dark",
      accent: "blue",
      textSize: "large",
      showGrid: false,
      interfaceFont: "monospace",
      readingFont: "serif",
    });
    expect(store.settings().model).toBe("local-test");
    expect(store.settings().reasoningEffort).toBe("high");
    expect(store.settings().customInstructions).toBe(
      "Lead with the answer.\nKeep uncertainty visible.",
    );
    expect(JSON.stringify(store.list())).not.toContain("Lead with the answer.");
    expect(JSON.stringify(store.list())).not.toContain("local-test");
    expect(JSON.stringify(store.list())).not.toContain("appearance");
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("does not overwrite saved data with an invalid tree", () => {
  const s = new Store(":memory:");
  try {
    const b = exampleBoard();
    s.save(b);
    const invalid = structuredClone(b);
    invalid.edges = [];
    expect(() => s.save(invalid)).toThrow();
    expect(s.list()).toEqual([b]);
  } finally {
    s.close();
  }
});
