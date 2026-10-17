import { test, expect } from "@playwright/test";

test("sidebar Board menu renames and deletes the targeted inactive Board", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
  );
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const target = page
    .locator(".boards button")
    .filter({ hasText: original.title });
  await target.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Board actions" });
  await expect(
    menu.getByRole("menuitem", { name: "Rename", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("board-context-menu.png"),
  });
  await menu.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Board name" })
    .fill("Renamed from sidebar");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.locator("h1")).toHaveText("Untitled inquiry");
  const renamed = page
    .locator(".boards button")
    .filter({ hasText: "Renamed from sidebar" });
  await expect(renamed).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem("inquiry.boards")!).find(
            (b: { id: string }) => b.id === id,
          )?.title,
        original.id,
      ),
    )
    .toBe("Renamed from sidebar");
  const saved = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem("inquiry.boards")!).find(
        (b: { id: string }) => b.id === id,
      ),
    original.id,
  );
  expect(saved.notes).toEqual(original.notes);
  expect(saved.edges).toEqual(original.edges);
  await renamed.click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Delete Board",
    exact: true,
  });
  await expect(confirmation).toContainText("Renamed from sidebar");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(renamed).toBeVisible();
  await renamed.click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete Board permanently" }).click();
  await expect(renamed).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText("Untitled inquiry");
  await page.reload();
  await expect(page.locator(".boards button")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Untitled inquiry");
});

test("sidebar Board menu supports keyboard navigation and dismissal", async ({
  page,
}) => {
  await page.goto("/");
  const board = page.locator(".boards button").first();
  await board.focus();
  await board.press("Shift+F10");
  const menu = page.getByRole("menu", { name: "Board actions" });
  await expect(
    menu.getByRole("menuitem", { name: "Rename", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", { name: "Delete", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(board).toBeFocused();
  await board.click({ button: "right" });
  await page.locator("h1").click();
  await expect(menu).toHaveCount(0);
  await board.press("Shift+F10");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Rename Board" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(board).toBeFocused();
});

test("Board names can be saved, cancelled and reopened without changing Notes", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
  );
  const rename = page.getByRole("button", {
    name: "Rename Board",
    exact: true,
  });
  await rename.click();
  const dialog = page.getByRole("dialog", { name: "Rename Board" });
  const input = dialog.getByRole("textbox", { name: "Board name" });
  await expect(input).toBeFocused();
  await input.fill("   ");
  await expect(
    dialog.getByRole("button", { name: "Save name" }),
  ).toBeDisabled();
  await input.fill("Discard this name");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("h1")).toHaveText(original.title);
  await expect(rename).toBeFocused();
  await rename.click();
  await expect(input).toHaveValue(original.title);
  await input.fill("Escape this name");
  await input.press("Escape");
  await expect(dialog).toHaveCount(0);
  await rename.click();
  await input.fill("  Language and machine intelligence  ");
  await input.press("Enter");
  await expect(page.locator("h1")).toHaveText(
    "Language and machine intelligence",
  );
  await expect(page.locator(".board-title-row h1")).toHaveAttribute(
    "title",
    "Language and machine intelligence",
  );
  await expect(page.locator(".boards button.active")).toContainText(
    "Language and machine intelligence",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0].title,
      ),
    )
    .toBe("Language and machine intelligence");
  await page.reload();
  await expect(page.locator("h1")).toHaveText(
    "Language and machine intelligence",
  );
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
  );
  expect(saved.id).toBe(original.id);
  expect(saved.notes).toEqual(original.notes);
  expect(saved.edges).toEqual(original.edges);
  expect(saved.artefacts).toEqual(original.artefacts);
  await page.screenshot({ path: testInfo.outputPath("renamed-board.png") });
});

test("an empty Board keeps its chosen name after its first question", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Rename Board", exact: true }).click();
  await page.getByRole("textbox", { name: "Board name" }).fill("My research");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.getByRole("button", { name: "Ask your first question" }).click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What is machine intelligence?");
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(page.locator(".note-card")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("My research");
});
