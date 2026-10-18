import { test, expect } from "@playwright/test";
import { exampleBoard } from "../../src/core/example";
import { defaults } from "../../src/core/model";

for (const noteStyle of [
  "classic",
  "sticky",
  "blueprint",
  "index",
  "studio",
] as const) {
  for (const area of ["title", "body"] as const) {
    test(`${noteStyle}: drag an unselected overview Note by its ${area}`, async ({
      page,
    }) => {
      const board = exampleBoard();
      board.viewport = { x: 0, y: 0, zoom: 0.4 };
      await page.addInitScript(
        ({ board, settings }) => {
          if (!localStorage.getItem("inquiry.boards")) {
            localStorage.setItem("inquiry.boards", JSON.stringify([board]));
            localStorage.setItem("inquiry.settings", JSON.stringify(settings));
          }
        },
        {
          board,
          settings: {
            ...defaults,
            appearance: { ...defaults.appearance, noteStyle },
          },
        },
      );
      await page.goto("/");
      const card = page.locator(".note-card").first();
      await expect(card).toHaveClass(/overview/);
      await expect(card).not.toHaveClass(/focused|chosen/);
      const box = await (
        area === "title" ? card.locator(".note-prompt") : card
      ).boundingBox();
      const x =
        area === "title" ? box!.x + box!.width / 2 : box!.x + box!.width - 12;
      const y =
        area === "title" ? box!.y + box!.height / 2 : box!.y + box!.height - 10;
      await page.mouse.move(x, y);
      await expect(
        area === "title" ? card.locator(".note-prompt") : card,
      ).toHaveCSS("cursor", "grab");
      await page.mouse.down();
      await page.mouse.move(x + 50, y + 40, { steps: 10 });
      await page.mouse.up();
      await expect(page.locator(".reader")).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
                .position.x,
          ),
        )
        .toBeGreaterThan(board.notes[0].position.x + 80);
      const moved = await page.evaluate(
        () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
      );
      expect(moved.edges).toEqual(board.edges);
      expect(moved.notes[0].versions).toEqual(board.notes[0].versions);
      expect(moved.notes.slice(1)).toEqual(board.notes.slice(1));
      await card.getByRole("checkbox").check();
      await expect(card).toHaveClass(/chosen/);
      await card.getByLabel("Layout Note 1", { exact: true }).click();
      await expect(
        card.getByRole("button", {
          name: "Move with descendants",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
              .position,
        ),
      ).toEqual(moved.notes[0].position);
      await page
        .getByRole("button", { name: "Undo layout", exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
                .position,
          ),
        )
        .toEqual(board.notes[0].position);
      await page
        .getByRole("button", { name: "Redo layout", exact: true })
        .click();
      await page.reload();
      await expect(card).toHaveClass(/overview/);
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
              .position,
        ),
      ).toEqual(moved.notes[0].position);
    });
  }
}
