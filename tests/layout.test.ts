import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Store } from "../electron/store";
import { exampleBoard } from "../src/core/example";
import { validateBoard, type Board } from "../src/core/model";
import { buildContext } from "../src/core/context";
import {
  alignmentGuides,
  applyLayout,
  bounds,
  connectionSides,
  overlaps,
  placeChild,
  snapshot,
  subtreeIds,
  tidyBranch,
  translate,
  type Sizes,
} from "../src/core/layout";

function fixture() {
  const board = exampleBoard();
  board.notes.forEach((n, i) => {
    n.id = `n${i}`;
  });
  board.edges.forEach((edge, i) => {
    edge.source = "n0";
    edge.target = `n${i + 1}`;
    edge.highlight!.sourceId = "n0";
  });
  return board;
}
function extend(board: Board, parent: string, id: string) {
  board.notes.push({
    ...structuredClone(board.notes[1]),
    id,
    position: { x: 900, y: 400 },
  });
  board.edges.push({
    ...structuredClone(board.edges[0]),
    id: `edge-${id}`,
    source: parent,
    target: id,
  });
}

describe("graph layout", () => {
  it("places new children using measured bounds, direction and stationary obstacles", () => {
    const b = fixture();
    const parent = b.notes[0];
    const sizes: Sizes = Object.fromEntries(
      b.notes.map((n) => [n.id, { width: 320, height: 270 }]),
    );
    const original = structuredClone(b);
    for (const childDirection of ["right", "below"] as const) {
      parent.childDirection = childDirection;
      const position = placeChild(
        b,
        parent,
        { width: 360, height: 400 },
        sizes,
      );
      const box = { ...position, width: 360, height: 400 };
      expect(b.notes.every((n) => !overlaps(box, bounds(n, sizes), 60))).toBe(
        true,
      );
      if (childDirection === "right")
        expect(position.x).toBe(parent.position.x + 320 + 90);
      else expect(position.y).toBe(parent.position.y + 270 + 90);
    }
    expect(b.notes.map((n) => n.position)).toEqual(
      original.notes.map((n) => n.position),
    );
  });

  it("tidies mixed directions deterministically, preserves root and avoids fixed obstacles", () => {
    const b = fixture();
    extend(b, "n1", "n3");
    extend(b, "n1", "n4");
    b.notes[1].childDirection = "below";
    const sizes = Object.fromEntries(
      b.notes.map((n, i) => [
        n.id,
        { width: 260 + i * 20, height: 180 + i * 30 },
      ]),
    );
    const initial = structuredClone(b);
    const positions = tidyBranch(b, "n0", sizes);
    expect(positions).toEqual(tidyBranch(b, "n0", sizes));
    expect(positions.n0).toEqual(b.notes[0].position);
    expect(positions.n3.y).toBeGreaterThan(positions.n1.y);
    expect(positions.n4.x).toBeGreaterThan(positions.n3.x);
    for (const a of b.notes)
      for (const c of b.notes)
        if (a.id !== c.id)
          expect(
            overlaps(bounds(a, sizes, positions), bounds(c, sizes, positions)),
          ).toBe(false);
    const branch = tidyBranch(b, "n1", sizes);
    expect(branch.n0).toBeUndefined();
    expect(branch.n2).toBeUndefined();
    for (const id of ["n3", "n4"])
      for (const outside of [b.notes[0], b.notes[2]])
        expect(
          overlaps(
            bounds(
              b.notes.find((n) => n.id === id)!,
              sizes,
              branch,
            ),
            bounds(outside, sizes),
            60,
          ),
        ).toBe(false);
    expect(b).toEqual(initial);
  });

  it("keeps spatial sibling order and uses Board order for ties", () => {
    const b = fixture();
    b.notes[1].position.y = 600;
    b.notes[2].position.y = 0;
    expect(tidyBranch(b, "n0", {}).n2.y).toBeLessThan(
      tidyBranch(b, "n0", {}).n1.y,
    );
    b.notes[1].position.y = 0;
    expect(tidyBranch(b, "n0", {}).n1.y).toBeLessThan(
      tidyBranch(b, "n0", {}).n2.y,
    );
  });

  it("adapts facing sides including horizontal ties and variable sizes", () => {
    const source = { x: 0, y: 0, width: 300, height: 200 };
    for (const [x, y, expected] of [
      [500, 0, ["right", "left"]],
      [-500, 0, ["left", "right"]],
      [0, 500, ["bottom", "top"]],
      [0, -500, ["top", "bottom"]],
      [500, 500, ["right", "left"]],
    ] as const) {
      const sides = connectionSides(source, { ...source, x, y });
      expect([sides.source, sides.target]).toEqual(expected);
    }
    expect(
      connectionSides(source, { x: 0, y: 250, width: 360, height: 500 }).source,
    ).toBe("bottom");
  });

  it("translates a subtree without changing provenance, context or current content", () => {
    const b = exampleBoard();
    const ids = subtreeIds(b, b.notes[0].id);
    expect(ids.size).toBe(3);
    const positions = Object.fromEntries(
      b.notes.map((n) => [n.id, n.position]),
    );
    const moved = applyLayout(b, translate(positions, { x: -150, y: 400 }));
    expect(moved.edges).toEqual(b.edges);
    expect(buildContext(moved, "Follow up", b.edges[0].highlight)).toEqual(
      buildContext(b, "Follow up", b.edges[0].highlight),
    );
    moved.notes[1].title = "New title during layout history";
    const restored = applyLayout(moved, snapshot(b));
    expect(restored.notes[1].title).toBe("New title during layout history");
    expect(restored.notes[1].versions).toEqual(b.notes[1].versions);
    expect(restored.notes.map((n) => n.position)).toEqual(
      b.notes.map((n) => n.position),
    );
  });

  it("shows guides within six screen pixels without altering coordinates", () => {
    const moving = { x: 105, y: 100, width: 300, height: 200 };
    const fixed = { x: 100, y: 600, width: 300, height: 200 };
    expect(
      alignmentGuides(moving, [fixed], 1).filter((g) => g.axis === "x"),
    ).toHaveLength(3);
    expect(alignmentGuides(moving, [fixed], 1.5)).toHaveLength(0);
    expect(moving.x).toBe(105);
  });

  it("validates optional direction and reopens layout metadata through SQLite and JSON", () => {
    const b = exampleBoard();
    expect(validateBoard(b).notes[0].childDirection).toBeUndefined();
    b.notes[0].childDirection = "below";
    b.notes[1].position = { x: -200, y: 900 };
    expect(validateBoard(JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(() =>
      validateBoard({
        ...b,
        notes: [
          { ...b.notes[0], childDirection: "diagonal" },
          ...b.notes.slice(1),
        ],
      }),
    ).toThrow();
    const dir = mkdtempSync(path.join(tmpdir(), "noteboard-layout-"));
    let store: Store | undefined;
    try {
      store = new Store(path.join(dir, "board.sqlite"));
      store.save(b);
      store.close();
      store = new Store(path.join(dir, "board.sqlite"));
      expect(store.list()).toEqual([b]);
    } finally {
      store?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
