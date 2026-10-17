import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Board } from "../../src/core/model";

test("exporting a dirty synthesis includes one revision and retains history after reopening", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page.getByRole("button", { name: "Create artefact" }).click();
  await expect(page.locator(".document-preview")).toBeVisible();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0] as Board,
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Synthesis document" });
  const draft =
    (await editor.inputValue()) + "\n\nA retained draft for export.";
  await editor.fill(draft);
  await page.getByRole("button", { name: "More", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export Board" }).click();
  const downloaded = await downloading;
  const exported = JSON.parse(
    await readFile((await downloaded.path())!, "utf8"),
  ) as Board;
  expect(exported.artefacts[0].versions).toHaveLength(2);
  expect(exported.artefacts[0].versions[0]).toEqual(
    original.artefacts[0].versions[0],
  );
  expect(exported.artefacts[0].versions[1].text).toBe(draft);
  expect(exported.artefacts[0].sourceVersions).toEqual(
    original.artefacts[0].sourceVersions,
  );
  expect(exported.notes).toEqual(original.notes);

  // Export also preserves the open draft through the normal save path, without another revision on navigation.
  await expect(page.getByLabel("Document version")).toContainText(
    "History · 2 versions",
  );
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .locator(".artefact-list")
    .getByRole("button", { name: "Learning journey" })
    .click();
  await expect(page.locator(".document-preview")).toContainText(
    "A retained draft for export.",
  );
  await expect(page.getByLabel("Document version")).toContainText(
    "History · 2 versions",
  );
});
