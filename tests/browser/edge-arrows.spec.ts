import { test, expect } from "@playwright/test";
import { exampleBoard } from "../../src/core/example";

for (const zoom of [0.35, 0.8]) {
  for (const [direction, position, side] of [
    ["right", { x: 900, y: 450 }, "left"],
    ["left", { x: 0, y: 450 }, "right"],
    ["above", { x: 450, y: 0 }, "bottom"],
    ["below", { x: 450, y: 900 }, "top"],
  ] as const) {
    test(`${direction} child: arrow stays visible and points towards the child at zoom ${zoom}`, async ({
      page,
    }) => {
      const board = exampleBoard();
      board.notes = board.notes.slice(0, 2);
      board.edges = board.edges.slice(0, 1);
      board.notes[0].position = { x: 450, y: 450 };
      board.notes[1].position = position;
      board.viewport = { x: 0, y: 0, zoom };
      await page.addInitScript(
        (board) =>
          localStorage.setItem("inquiry.boards", JSON.stringify([board])),
        board,
      );
      await page.goto("/");
      await page
        .getByRole("combobox", { name: "Note mode", exact: true })
        .selectOption("arrange");
      const edge = page.locator(".react-flow__edge");
      await expect(edge.locator("[data-target-side]")).toHaveAttribute(
        "data-target-side",
        side,
      );
      const marker = edge.locator("marker.note-edge-arrow");
      await expect(marker).toHaveCount(1);
      await expect(marker).toHaveAttribute("orient", "auto");
      await expect(marker).toHaveAttribute("markerUnits", "userSpaceOnUse");
      expect(
        Number(await marker.getAttribute("markerWidth")) * zoom,
      ).toBeCloseTo(14, 3);
      const path = edge.locator(".react-flow__edge-path");
      await expect(path).toHaveAttribute(
        "marker-end",
        `url(#${await marker.getAttribute("id")})`,
      );
      await expect(path).toHaveCSS("stroke-width", `${1.75 / zoom}px`);
      const endpoint = await path.evaluate((element) => {
        const path = element as SVGPathElement;
        const point = path.getPointAtLength(path.getTotalLength());
        const screen = new DOMPoint(point.x, point.y).matrixTransform(
          path.getScreenCTM()!,
        );
        return { x: screen.x, y: screen.y };
      });
      const child = (await page
        .locator(".note-card")
        .nth(1)
        .locator(`[data-handleid="target-${side}"]`)
        .boundingBox())!;
      const distance =
        side === "left"
          ? child.x - endpoint.x
          : side === "right"
            ? endpoint.x - child.x - child.width
            : side === "top"
              ? child.y - endpoint.y
              : endpoint.y - child.y - child.height;
      expect(distance).toBeCloseTo(7, 0);
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0].edges,
        ),
      ).toEqual(board.edges);
      await page.screenshot({
        path: test.info().outputPath(`${direction}-${zoom}-arrow.png`),
      });
    });
  }
}
