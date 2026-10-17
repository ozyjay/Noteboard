import { test, expect } from "@playwright/test";

test("highlight, branch, reload, synthesise, revise and return to a source", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "How do complex systems work?",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await page.locator(".reader-response").evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const start = node.data.indexOf("emergence");
      if (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 9);
        const s = window.getSelection()!;
        s.removeAllRanges();
        s.addRange(range);
        root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        break;
      }
    }
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue("What is emergence?");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How does emergence relate to feedback?");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".note-card")).toHaveCount(4);
  await expect(page.locator(".reader h2").first()).toHaveText(
    "How does emergence relate to feedback?",
  );
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select Note 1 for synthesis" })
    .check();
  await page
    .getByRole("checkbox", { name: "Select Note 4 for synthesis" })
    .check();
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page.getByRole("button", { name: "Create artefact" }).click();
  await expect(page.locator(".document-preview")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Synthesis document" });
  expect(await editor.inputValue()).toContain(
    "How does emergence relate to feedback?",
  );
  expect(await editor.inputValue()).not.toContain(
    "## Patterns from local interactions",
  );
  await editor.fill(
    (await editor.inputValue()) + "\n\nMy reviewed conclusion.",
  );
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByLabel("Document version")).toContainText(
    "History · 2 versions",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page
    .locator(".document-preview")
    .getByRole("button", { name: "Open source Note" })
    .first()
    .click();
  await expect(page.locator(".reader h2").first()).toHaveText(
    "How do complex systems work?",
  );
  await expect(page.locator(".note-card")).toHaveCount(4);
  await page.reload();
  await page.locator(".artefact-list button").first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Synthesis document" }),
  ).toHaveValue(/My reviewed conclusion/);
});
