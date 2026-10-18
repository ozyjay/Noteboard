import type { Board, Note } from "./model";
import { subtreeIds } from "./deletion";
export { subtreeIds } from "./deletion";

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Bounds = Point & Size;
export type Sizes = Record<string, Size>;
export type Positions = Record<string, Point>;
export type LayoutValue = Point & { childDirection?: "right" | "below" };
export type LayoutSnapshot = Record<string, LayoutValue>;
export const parentGap = 90;
export const siblingGap = 60;
const fallbackSize = { width: 360, height: 300 };

export function bounds(
  note: Note,
  sizes: Sizes,
  positions: Positions = {},
): Bounds {
  return {
    ...(positions[note.id] ?? note.position),
    ...(sizes[note.id] ?? fallbackSize),
  };
}

export function overlaps(a: Bounds, b: Bounds, gap = 0) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

function union(boxes: Bounds[]): Bounds {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

export function translate(positions: Positions, delta: Point): Positions {
  return Object.fromEntries(
    Object.entries(positions).map(([id, p]) => [
      id,
      { x: p.x + delta.x, y: p.y + delta.y },
    ]),
  );
}

export function placeChild(
  board: Board,
  parent: Note,
  size: Size,
  sizes: Sizes,
): Point {
  const p = bounds(parent, sizes);
  const below = parent.childDirection === "below";
  const candidate = {
    x: below ? p.x : p.x + p.width + parentGap,
    y: below ? p.y + p.height + parentGap : p.y,
    ...size,
  };
  let collisions: Bounds[];
  while (
    (collisions = board.notes
      .map((n) => bounds(n, sizes))
      .filter((b) => overlaps(candidate, b, siblingGap))).length
  ) {
    if (below)
      candidate.x = Math.max(
        ...collisions.map((b) => b.x + b.width + siblingGap),
      );
    else
      candidate.y = Math.max(
        ...collisions.map((b) => b.y + b.height + siblingGap),
      );
  }
  return { x: candidate.x, y: candidate.y };
}

export function tidyBranch(
  board: Board,
  root: string,
  sizes: Sizes,
): Positions {
  const included = subtreeIds(board, root);
  const notes = new Map(board.notes.map((n) => [n.id, n]));
  const obstacles = board.notes
    .filter((n) => !included.has(n.id))
    .map((n) => bounds(n, sizes));
  const build = (id: string): Positions => {
    const note = notes.get(id)!;
    const below = note.childDirection === "below";
    const axis = below ? "x" : "y";
    const children = board.notes
      .filter((n) =>
        board.edges.some((e) => e.source === id && e.target === n.id),
      )
      .sort((a, b) => a.position[axis] - b.position[axis]);
    const own = sizes[id] ?? fallbackSize;
    let result: Positions = { [id]: { x: 0, y: 0 } };
    let offset = 0;
    for (const child of children) {
      let block = build(child.id);
      const box = union(
        Object.entries(block).map(([key, point]) => ({
          ...point,
          ...(sizes[key] ?? fallbackSize),
        })),
      );
      block = translate(block, {
        x: below ? offset : own.width + parentGap,
        y: below ? own.height + parentGap : offset,
      });
      result = { ...result, ...block };
      offset += (below ? box.width : box.height) + siblingGap;
    }
    return result;
  };
  let result = translate(build(root), notes.get(root)!.position);
  // Resolve fixed obstacles top-down, translating complete child blocks.
  const resolve = (id: string) => {
    const parent = notes.get(id)!;
    const below = parent.childDirection === "below";
    const children = board.notes
      .filter((n) =>
        board.edges.some((e) => e.source === id && e.target === n.id),
      )
      .sort(
        (a, b) => a.position[below ? "x" : "y"] - b.position[below ? "x" : "y"],
      );
    const occupied: Bounds[] = [bounds(parent, sizes, result)];
    for (const child of children) {
      const ids = subtreeIds(board, child.id);
      const blockBox = () =>
        union([...ids].map((key) => bounds(notes.get(key)!, sizes, result)));
      let box = blockBox();
      let hits: Bounds[];
      while (
        (hits = [...obstacles, ...occupied].filter((b) =>
          overlaps(box, b, siblingGap),
        )).length
      ) {
        const delta = below
          ? {
              x:
                Math.max(...hits.map((b) => b.x + b.width + siblingGap)) -
                box.x,
              y: 0,
            }
          : {
              x: 0,
              y:
                Math.max(...hits.map((b) => b.y + b.height + siblingGap)) -
                box.y,
            };
        for (const key of ids)
          result[key] = {
            x: result[key].x + delta.x,
            y: result[key].y + delta.y,
          };
        box = blockBox();
      }
      resolve(child.id);
      // Descendant obstacle avoidance can enlarge the block; reserve its final bounds.
      occupied.push(blockBox());
    }
  };
  resolve(root);
  return result;
}

export function connectionSides(source: Bounds, target: Bounds) {
  const dx = target.x + target.width / 2 - source.x - source.width / 2;
  const dy = target.y + target.height / 2 - source.y - source.height / 2;
  if (Math.abs(dx) >= Math.abs(dy))
    return dx >= 0
      ? ({ source: "right", target: "left" } as const)
      : ({ source: "left", target: "right" } as const);
  return dy >= 0
    ? ({ source: "bottom", target: "top" } as const)
    : ({ source: "top", target: "bottom" } as const);
}

export function snapshot(board: Board): LayoutSnapshot {
  return Object.fromEntries(
    board.notes.map((n) => [
      n.id,
      { ...n.position, childDirection: n.childDirection },
    ]),
  );
}

export function applyLayout(
  board: Board,
  values: LayoutSnapshot | Positions,
): Board {
  return {
    ...board,
    notes: board.notes.map((n) => {
      const value = values[n.id];
      return value
        ? {
            ...n,
            position: { x: value.x, y: value.y },
            ...("childDirection" in value
              ? { childDirection: value.childDirection }
              : {}),
          }
        : n;
    }),
  };
}

export function alignmentGuides(
  moving: Bounds,
  stationary: Bounds[],
  zoom: number,
) {
  const guides: {
    axis: "x" | "y";
    value: number;
    start: number;
    end: number;
  }[] = [];
  for (const axis of ["x", "y"] as const) {
    const other = axis === "x" ? "y" : "x";
    const size = axis === "x" ? "width" : "height";
    const otherSize = axis === "x" ? "height" : "width";
    for (const b of stationary)
      for (const fraction of [0, 0.5, 1]) {
        const value = b[axis] + b[size] * fraction;
        if (
          Math.abs(moving[axis] + moving[size] * fraction - value) * zoom <=
          6
        )
          guides.push({
            axis,
            value,
            start: Math.min(moving[other], b[other]),
            end: Math.max(
              moving[other] + moving[otherSize],
              b[other] + b[otherSize],
            ),
          });
      }
  }
  return guides;
}
