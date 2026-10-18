import { test, expect, type Page } from "@playwright/test";
import { exampleBoard } from "../../src/core/example";
import { defaults } from "../../src/core/model";

async function open(page: Page, zoom: number) {
  const board = exampleBoard();
  board.viewport = { x: 0, y: 0, zoom };
  await page.addInitScript(
    ({ board, settings }) => {
      if (!localStorage.getItem("inquiry.boards")) {
        localStorage.setItem("inquiry.boards", JSON.stringify([board]));
        localStorage.setItem("inquiry.settings", JSON.stringify(settings));
      }
    },
    { board, settings: defaults },
  );
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  return board;
}
async function zoom(page: Page, direction: "In" | "Out", expected: number) {
  await page
    .getByRole("button", { name: `Zoom ${direction}`, exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("inquiry.boards")!)[0].viewport.zoom,
      ),
    )
    .toBeCloseTo(expected, 3);
}

test("visible Auto mode reports the effective mode as zoom crosses its threshold", async ({
  page,
}) => {
  const board = await open(page, 0.6);
  const mode = page.getByRole("combobox", { name: "Note mode", exact: true });
  await expect(mode).toBeVisible();
  await expect(mode).toHaveValue("auto");
  await expect(page.locator(".canvas-mode-hint")).toHaveText(
    "Read · Drag a header to move a Note",
  );
  await zoom(page, "Out", 0.5);
  await expect(page.locator(".note-card.overview")).toHaveCount(3);
  await expect(page.locator(".canvas-mode-hint")).toHaveText(
    "Arrange · Drag anywhere on a Note",
  );
  await zoom(page, "In", 0.6);
  await expect(page.locator(".note-card.overview")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes,
    ),
  ).toEqual(board.notes);
});

test("manual Arrange overrides zoom, supports whole-card movement and locks during previews", async ({
  page,
}) => {
  const board = await open(page, 0.8);
  const mode = page.getByRole("combobox", { name: "Note mode", exact: true });
  await mode.selectOption("arrange");
  const card = page.locator(".note-card").first();
  await expect(card).toHaveClass(/overview/);
  await zoom(page, "In", 0.96);
  await expect(card).toHaveClass(/overview/);
  const title = (await card.locator(".note-prompt").boundingBox())!;
  const x = title.x + title.width / 2;
  const y = title.y + title.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 60, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
            .position.x,
      ),
    )
    .toBeGreaterThan(board.notes[0].position.x + 40);
  await expect(page.locator(".reader")).toHaveCount(0);
  await card.getByLabel("Layout Note 1", { exact: true }).click();
  await card.getByRole("button", { name: "Tidy branch", exact: true }).click();
  await expect(mode).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(mode).toBeEnabled();
  await mode.selectOption("auto");
  await expect(card).not.toHaveClass(/overview/);
});

test("manual Read overrides low zoom, retains title reading, and resets to Auto on reopening", async ({
  page,
}) => {
  const board = await open(page, 0.4);
  const mode = page.getByRole("combobox", { name: "Note mode", exact: true });
  await mode.selectOption("read");
  await expect(page.locator(".note-card.overview")).toHaveCount(0);
  await zoom(page, "Out", 0.4 / 1.2);
  await expect(page.locator(".note-card.overview")).toHaveCount(0);
  await page
    .locator(".note-card")
    .first()
    .getByRole("button", { name: board.notes[0].prompt, exact: true })
    .click();
  await expect(page.locator(".reader-response")).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes,
    ),
  ).toEqual(board.notes);
  await page.reload();
  await expect(mode).toHaveValue("auto");
  await expect(page.locator(".note-card.overview")).toHaveCount(3);
});
