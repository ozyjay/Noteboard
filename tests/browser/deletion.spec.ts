import { test, expect } from "@playwright/test";

test("deletion confirms subtrees, preserves synthesis sources and survives reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page
    .getByRole("button", { name: "Create artefact", exact: true })
    .click();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator(".note-card").first().getByRole("button").first().click();
  await page.getByRole("button", { name: "Delete Note", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Note", exact: true });
  await expect(dialog).toContainText("3 Notes in total");
  await page.screenshot({
    path: testInfo.outputPath("delete-note-confirmation.png"),
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Delete Note", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Note and descendants", exact: true })
    .click();
  await expect(page.locator(".note-card")).toHaveCount(0);
  await expect(page.locator(".reader")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes.length,
      ),
    )
    .toBe(0);
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(0);
  await page.locator(".artefact-list button").first().click();
  await page
    .getByRole("button", { name: "Open source Note", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Archived source Note" }),
  ).toContainText("How do complex systems work?");
  await page.screenshot({ path: testInfo.outputPath("archived-source.png") });
  await page
    .getByRole("button", { name: "Close source Note", exact: true })
    .click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Delete Board", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".artefact-list button")).toHaveCount(1);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Delete Board", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Board permanently", exact: true })
    .click();
  await expect(page.locator(".board-title-row h1")).toHaveText(
    "Untitled inquiry",
  );
  await expect(page.locator(".artefact-list button")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".board-title-row h1")).toHaveText(
    "Untitled inquiry",
  );
  await expect(page.locator(".boards button")).toHaveCount(1);
});

test("Board deletion failures retain the Board for retry", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (key, value) {
      if (fail && key === "inquiry.boards" && value === "[]") {
        fail = false;
        throw new Error("Simulated deletion failure");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Delete Board", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Board permanently", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Simulated deletion failure",
  );
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Delete Board permanently", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".board-title-row h1")).toHaveText(
    "Untitled inquiry",
  );
});
