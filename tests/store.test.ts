import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../electron/store";
import { exampleBoard } from "../src/core/example";
import { defaults, uid, now, response } from "../src/core/model";
it("reopens SQLite with spatial positions, exact anchors, effective context and document history", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-test-"));
  const db = path.join(dir, "test.sqlite");
  try {
    const b = exampleBoard();
    b.notes[0].position = { x: 123, y: 456 };
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
