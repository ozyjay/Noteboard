import { test, expect, type Page } from "@playwright/test";
import { defaults, type Board } from "../../src/core/model";

async function saved(page: Page): Promise<Board> {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
  );
}
async function start(page: Page, style = "classic", zoom = 0.8, deep = false) {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page.evaluate(
    ({ style, zoom, defaults, deep }) => {
      const boards = JSON.parse(localStorage.getItem("inquiry.boards")!);
      boards[0].viewport = { x: 0, y: 0, zoom };
      boards[0].notes[0].position = { x: 100, y: 140 };
      boards[0].notes[1].position = { x: 600, y: 100 };
      boards[0].notes[2].position = { x: 600, y: 500 };
      if (deep) {
        const parent = boards[0].notes[1];
        const child = structuredClone(parent);
        child.id = crypto.randomUUID();
        child.position = { x: 1000, y: 100 };
        child.versions.forEach((v: { id: string }) => {
          v.id = crypto.randomUUID();
        });
        boards[0].notes.push(child);
        const text = "Emergence";
        const start = parent.versions[0].text.indexOf(text);
        boards[0].edges.push({
          id: crypto.randomUUID(),
          kind: "highlight",
          source: parent.id,
          target: child.id,
          highlight: {
            sourceId: parent.id,
            versionId: parent.versions[0].id,
            text,
            start,
            end: start + text.length,
            surface: "markdown",
          },
        });
      }
      localStorage.setItem("inquiry.boards", JSON.stringify(boards));
      const settings = JSON.parse(
        localStorage.getItem("inquiry.settings") || JSON.stringify(defaults),
      );
      settings.appearance = { ...settings.appearance, noteStyle: style };
      localStorage.setItem("inquiry.settings", JSON.stringify(settings));
    },
    { style, zoom, defaults, deep },
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(deep ? 4 : 3);
}
async function menu(page: Page, index: number, action: string) {
  const card = page.locator(".note-card").nth(index);
  await card.getByLabel(`Layout Note ${index + 1}`, { exact: true }).click();
  await card.getByRole("button", { name: action, exact: true }).click();
}

test("moves a child below its parent, adapts connections and preserves source history", async ({
  page,
}) => {
  await start(page);
  const original = await saved(page);
  const card = page.locator(".note-card").nth(1);
  const header = (await card.locator(".note-number").boundingBox())!;
  await page.mouse.move(header.x + 10, header.y + 5);
  await page.mouse.down();
  await page.mouse.move(header.x + 10 - 400, header.y + 5 + 400, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeEnabled();
  const moved = await saved(page);
  expect(moved.notes[1].position.y).toBeGreaterThan(
    original.notes[0].position.y + 300,
  );
  expect(moved.notes[0]).toEqual(original.notes[0]);
  expect(moved.notes[2]).toEqual(original.notes[2]);
  expect(moved.edges).toEqual(original.edges);
  expect(moved.notes[1].versions).toEqual(original.notes[1].versions);
  const edge = page.locator(`[data-testid="rf__edge-${original.edges[0].id}"]`);
  await expect(edge.locator("[data-source-side]")).toHaveAttribute(
    "data-source-side",
    "bottom",
  );
  await expect(edge.locator("[data-target-side]")).toHaveAttribute(
    "data-target-side",
    "top",
  );
  await page.getByRole("button", { name: "Undo layout", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).notes[1].position)
    .toEqual(original.notes[1].position);
  await page.getByRole("button", { name: "Redo layout", exact: true }).click();
  await page.reload();
  expect((await saved(page)).notes[1].position).toEqual(
    moved.notes[1].position,
  );
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeDisabled();
  await page.locator(".edge-label").first().click();
  await expect(page.locator(".reader-response")).toContainText(
    original.edges[0].highlight!.text,
  );
});

test("branch keyboard movement, cancellation, guides and layout history stay separate from editing", async ({
  page,
}) => {
  await start(page);
  const original = await saved(page);
  await menu(page, 0, "Move with descendants");
  await expect(page.getByRole("status")).toContainText("3 Notes");
  await expect(page.locator(".layout-moving")).toHaveCount(3);
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  expect((await saved(page)).notes).toEqual(original.notes);
  await menu(page, 0, "Move with descendants");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (await saved(page)).notes[0].position)
    .toEqual({ x: 110, y: 190 });
  const moved = await saved(page);
  moved.notes.forEach((n, i) =>
    expect(n.position).toEqual({
      x: original.notes[i].position.x + 10,
      y: original.notes[i].position.y + 50,
    }),
  );
  await menu(page, 1, "Move Note");
  await expect(page.locator(".layout-guides line")).not.toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const layoutBeforeEdit = (await saved(page)).notes.map((n) => n.position);
  await page
    .getByRole("button", { name: original.notes[0].prompt, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Note title", exact: true })
    .dblclick();
  const title = page.getByRole("textbox", { name: "Note title" });
  await title.fill("A changed title");
  await title.press("Meta+z");
  expect((await saved(page)).notes.map((n) => n.position)).toEqual(
    layoutBeforeEdit,
  );
  await title.fill("A changed title");
  await title.press("Enter");
  await page.getByRole("button", { name: "Undo layout", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).notes[1].position)
    .toEqual(moved.notes[1].position);
  expect((await saved(page)).notes[0].title).toBe("A changed title");
});

for (const style of ["classic", "sticky", "blueprint", "index", "studio"]) {
  test(`${style}: mixed-direction tidy preview is independent of zoom and preserves manual positions until Apply`, async ({
    page,
  }) => {
    await start(page, style, 0.8, true);
    const root = page.locator(".note-card").first();
    await root.getByLabel("Layout Note 1", { exact: true }).click();
    await expect(
      root.getByRole("radio", { name: "Right", exact: true }),
    ).toBeChecked();
    await root.getByRole("radio", { name: "Below", exact: true }).check();
    await expect
      .poll(async () => (await saved(page)).notes[0].childDirection)
      .toBe("below");
    const original = await saved(page);
    await root.getByLabel("Layout Note 1", { exact: true }).click();
    await expect(
      root.getByRole("radio", { name: "Below", exact: true }),
    ).toBeChecked();
    await root.getByLabel("Layout Note 1", { exact: true }).click();
    await menu(page, 0, "Tidy branch");
    await expect(page.getByRole("status")).toContainText("Tidy preview");
    await expect(
      root.getByRole("button", { name: original.notes[0].prompt, exact: true }),
    ).toBeDisabled();
    await expect(root.getByRole("checkbox")).toBeDisabled();
    await expect(page.locator(".topbar")).toHaveAttribute("inert", "");
    expect((await saved(page)).notes).toEqual(original.notes);
    const normal = await page
      .locator(".react-flow__node")
      .evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLElement).style.transform),
      );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    for (let step = 1; step <= 3; step++) {
      await page.getByRole("button", { name: "Zoom Out", exact: true }).click();
      await expect
        .poll(async () => (await saved(page)).viewport!.zoom)
        .toBeCloseTo(0.8 / 1.2 ** step, 3);
    }
    await expect(root).toHaveClass(/overview/);
    await menu(page, 0, "Tidy branch");
    expect(
      await page
        .locator(".react-flow__node")
        .evaluateAll((nodes) =>
          nodes.map((n) => (n as HTMLElement).style.transform),
        ),
    ).toEqual(normal);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect
      .poll(async () => (await saved(page)).notes[1].position.y)
      .toBeGreaterThan(original.notes[0].position.y);
    const applied = await saved(page);
    expect(applied.notes[0].position).toEqual(original.notes[0].position);
    expect(applied.edges).toEqual(original.edges);
    await page.screenshot({
      path: test.info().outputPath(`${style}-tidied.png`),
    });
    await page.reload();
    expect((await saved(page)).notes).toEqual(applied.notes);
  });
}

test("layout history follows Boards and clears after graph changes", async ({
  page,
}) => {
  await start(page);
  const original = await saved(page);
  await menu(page, 0, "Move Note");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".boards button")
    .filter({ hasText: original.title })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: original.notes[1].prompt, exact: true })
    .click();
  await page.getByRole("button", { name: "Delete Note", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Note and descendants", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeDisabled();
});

test("pointer branch movement is atomic and Escape restores a drag before release", async ({
  page,
}) => {
  await start(page);
  const original = await saved(page);
  await menu(page, 0, "Move with descendants");
  const header = (await page.locator(".note-number").first().boundingBox())!;
  await page.mouse.move(header.x + 10, header.y + 5);
  await page.mouse.down();
  await page.mouse.move(header.x + 90, header.y + 85, { steps: 10 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeEnabled();
  const moved = await saved(page);
  const dx = moved.notes[0].position.x - original.notes[0].position.x;
  const dy = moved.notes[0].position.y - original.notes[0].position.y;
  expect(dx).toBeGreaterThan(50);
  moved.notes.forEach((n, i) =>
    expect(n.position).toEqual({
      x: original.notes[i].position.x + dx,
      y: original.notes[i].position.y + dy,
    }),
  );
  await page.getByRole("button", { name: "Undo layout", exact: true }).click();
  const restoredHeader = (await page
    .locator(".note-number")
    .first()
    .boundingBox())!;
  await page.mouse.move(restoredHeader.x + 10, restoredHeader.y + 5);
  await page.mouse.down();
  await page.mouse.move(restoredHeader.x + 100, restoredHeader.y + 50, {
    steps: 8,
  });
  await page.keyboard.press("Escape");
  await page.mouse.move(restoredHeader.x + 120, restoredHeader.y + 60);
  await page.mouse.up();
  expect((await saved(page)).notes).toEqual(original.notes);
  await expect(page.locator(".react-flow__node").first()).toHaveCSS(
    "transform",
    `matrix(1, 0, 0, 1, 100, 140)`,
  );
});

test("new Highlight children use Below and measured normal-detail bounds", async ({
  page,
}) => {
  await start(page, "index");
  const original = await saved(page);
  const root = page.locator(".note-card").first();
  const normalHeight = (await root.boundingBox())!.height / 0.8;
  await root.getByLabel("Layout Note 1", { exact: true }).click();
  await root.getByRole("radio", { name: "Below", exact: true }).check();
  await root
    .getByRole("button", { name: original.notes[0].prompt, exact: true })
    .click();
  await page.locator(".reader-response").evaluate((surface) => {
    const range = document.createRange();
    range.selectNodeContents(surface.querySelector("strong")!);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    surface.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page
    .getByRole("button", { name: "Explore this passage", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Back to Board", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to Board", exact: true })
    .click();
  await expect(page.locator(".note-card")).toHaveCount(4);
  const board = await saved(page);
  expect(board.notes[3].position.x).toBe(original.notes[0].position.x);
  expect(board.notes[3].position.y).toBeCloseTo(
    original.notes[0].position.y + normalHeight + 90,
    3,
  );
  expect(board.notes[3].childDirection).toBeUndefined();
  board.notes
    .slice(0, 3)
    .forEach((n, i) => expect(n.position).toEqual(original.notes[i].position));
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeDisabled();
});

test("layout history retains fifty operations and a new change discards redo", async ({
  page,
}) => {
  test.setTimeout(60000);
  await start(page);
  const root = page.locator(".note-card").first();
  for (let index = 0; index < 51; index++) {
    await root.getByLabel("Layout Note 1", { exact: true }).click();
    await root
      .getByRole("radio", { name: index % 2 ? "Right" : "Below", exact: true })
      .check();
  }
  for (let index = 0; index < 50; index++)
    await page
      .getByRole("button", { name: "Undo layout", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Undo layout", exact: true }),
  ).toBeDisabled();
  await expect
    .poll(async () => (await saved(page)).notes[0].childDirection)
    .toBe("below");
  await expect(
    page.getByRole("button", { name: "Redo layout", exact: true }),
  ).toBeEnabled();
  await root.getByLabel("Layout Note 1", { exact: true }).click();
  await root.getByRole("radio", { name: "Right", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Redo layout", exact: true }),
  ).toBeDisabled();
});
