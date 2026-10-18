import { test, expect, type Page } from "@playwright/test";
import { exampleBoard } from "../../src/core/example";
import { defaults, type Board } from "../../src/core/model";

async function open(page: Page) {
  const board = exampleBoard();
  board.viewport = { x: 0, y: 0, zoom: 0.8 };
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
        appearance: { ...defaults.appearance, showGrid: false },
      },
    },
  );
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  return board;
}
async function saved(page: Page): Promise<Board> {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
  );
}

test("visible shortcuts toggle modes and snapping without interrupting typing or reading", async ({
  page,
}) => {
  const board = await open(page);
  const mode = page.getByRole("combobox", { name: "Note mode", exact: true });
  const snap = page.getByRole("checkbox", {
    name: "Snap to grid",
    exact: true,
  });
  await expect(mode).toHaveAttribute("aria-keyshortcuts", "A");
  await expect(snap).toHaveAttribute("aria-keyshortcuts", "G");
  await expect(snap).not.toBeChecked();
  await page.keyboard.press("a");
  await expect(mode).toHaveValue("arrange");
  await page.keyboard.press("g");
  await expect(snap).toBeChecked();
  await expect(page.locator(".react-flow__background")).toBeVisible();
  expect((await saved(page)).notes).toEqual(board.notes);
  const search = page.getByRole("textbox", {
    name: "Find a Board",
    exact: true,
  });
  await search.fill("ag");
  await search.press("a");
  await search.press("g");
  await expect(mode).toHaveValue("arrange");
  await expect(snap).toBeChecked();
  await search.fill("");
  await page.locator(".canvas-mode-hint").click();
  await page.keyboard.press("a");
  await expect(mode).toHaveValue("read");
  await page
    .locator(".note-card")
    .first()
    .getByRole("button", { name: board.notes[0].prompt, exact: true })
    .click();
  await page.locator(".reader-response").click();
  await page.keyboard.press("a");
  await page.keyboard.press("g");
  await expect(mode).toHaveValue("read");
  await expect(snap).toBeChecked();
});

test("snapped branch dragging preserves spacing and can be undone", async ({
  page,
}) => {
  const board = await open(page);
  await page.keyboard.press("a");
  await page.keyboard.press("g");
  const card = page.locator(".note-card").first();
  await card.getByLabel("Layout Note 1", { exact: true }).click();
  await card
    .getByRole("button", { name: "Move with descendants", exact: true })
    .click();
  const box = (await card.locator(".note-prompt").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 83, y + 47, { steps: 10 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeEnabled();
  const moved = await saved(page);
  await page.screenshot({
    path: test.info().outputPath("snapping-enabled.png"),
  });
  expect(moved.notes[0].position.x % 24).toBe(0);
  expect(moved.notes[0].position.y % 24).toBe(0);
  expect(moved.notes[0].position).not.toEqual(board.notes[0].position);
  const dx = moved.notes[0].position.x - board.notes[0].position.x;
  const dy = moved.notes[0].position.y - board.notes[0].position.y;
  moved.notes.forEach((n, index) =>
    expect(n.position).toEqual({
      x: board.notes[index].position.x + dx,
      y: board.notes[index].position.y + dy,
    }),
  );
  expect(moved.edges).toEqual(board.edges);
  expect(moved.notes.map((n) => n.versions)).toEqual(
    board.notes.map((n) => n.versions),
  );
  await page.getByRole("button", { name: "Undo layout", exact: true }).click();
  await expect.poll(async () => (await saved(page)).notes).toEqual(board.notes);
  await page.getByRole("button", { name: "Redo layout", exact: true }).click();
  await expect.poll(async () => (await saved(page)).notes).toEqual(moved.notes);
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Snap to grid", exact: true }),
  ).not.toBeChecked();
  await expect(page.locator(".react-flow__background")).toHaveCount(0);
  expect((await saved(page)).notes).toEqual(moved.notes);
});

test("snapped keyboard movement uses grid steps and locks shortcuts during a move", async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press("a");
  await page.keyboard.press("g");
  const card = page.locator(".note-card").first();
  await card.getByLabel("Layout Note 1", { exact: true }).click();
  await card.getByRole("button", { name: "Move Note", exact: true }).click();
  const snap = page.getByRole("checkbox", {
    name: "Snap to grid",
    exact: true,
  });
  await expect(snap).toBeDisabled();
  await page.keyboard.press("a");
  await page.keyboard.press("g");
  await expect(
    page.getByRole("combobox", { name: "Note mode", exact: true }),
  ).toHaveValue("arrange");
  await expect(snap).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (await saved(page)).notes[0].position)
    .toEqual({ x: 96, y: 288 });
});
