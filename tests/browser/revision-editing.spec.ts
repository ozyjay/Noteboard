import { test, expect } from "@playwright/test";

test("double-clicking Note text opens editors while single clicks and selection leave reading available", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".note-card .note-prompt").first().click();
  const displayedPrompt = page.getByRole("button", {
    name: "Edit displayed prompt and regenerate",
  });
  await displayedPrompt.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await displayedPrompt.dblclick();
  await expect(page.getByLabel("Revised prompt")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page
    .getByRole("button", { name: "Edit Note title", exact: true })
    .dblclick();
  await page.getByLabel("Note title", { exact: true }).fill("My own title");
  await page.getByLabel("Note title", { exact: true }).press("Enter");
  await expect(page.locator(".reader h2").first()).toHaveText("My own title");
  const prompt = page.getByRole("button", {
    name: "Edit displayed prompt and regenerate",
  });
  await prompt.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Revised prompt")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  const response = page.locator(".reader-response");
  await response.locator("p").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await response.locator("p").first().dblclick();
  await expect(page.getByLabel("Revised response")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await response.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Revised response")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await response.locator("p").first().scrollIntoViewIfNeeded();
  const bounds = await response.locator("p").first().boundingBox();
  await page.mouse.move(bounds!.x + 2, bounds!.y + 8);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 160, bounds!.y + 8, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Explore this passage", exact: true }),
  ).toBeVisible();
});

test("Note revisions preserve old Highlights, synthesis sources and prompts after reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("inquiry.boards")!)[0]);
  const before = await stored();
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page
    .getByRole("button", { name: "Create artefact", exact: true })
    .click();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator(".note-card .note-prompt").first().click();
  await page
    .getByRole("button", { name: "Edit prompt and regenerate", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Edit prompt and regenerate",
    exact: true,
  });
  await dialog.getByLabel("Revised prompt").fill("Discard this draft");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".reader h2").first()).toHaveText(
    before.notes[0].prompt,
  );
  await page
    .getByRole("button", { name: "Edit prompt and regenerate", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Edit prompt and regenerate",
    exact: true,
  });
  await dialog
    .getByLabel("Revised prompt")
    .fill("Explain the revised question clearly");
  await page.screenshot({ path: testInfo.outputPath("edit-prompt.png") });
  await dialog
    .getByRole("button", { name: "Generate new version", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".reader h2").first()).toHaveText(
    "Explain the revised question clearly",
  );
  await expect(
    page.getByLabel("Note version", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Regenerate response", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate new version", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByLabel("Note version", { exact: true }).locator("option"),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "Edit response", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Edit response", exact: true });
  await expect(dialog).toContainText("No model request is made");
  await dialog
    .getByLabel("Revised response")
    .fill(
      "## Reviewed answer\n\nMy corrected explanation includes **revised passage** and $x^2$.",
    );
  await dialog
    .getByRole("button", { name: "Save edited version", exact: true })
    .click();
  await expect(page.getByLabel("Note version", { exact: true })).toContainText(
    "Human-edited",
  );
  await expect(page.locator(".note-meta")).toContainText("HUMAN-EDITED");
  await expect(page.locator(".reader-response .katex")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("revision-history.png") });
  await expect
    .poll(async () => (await stored()).notes[0].versions.length)
    .toBe(4);
  const revised = await stored();
  expect(revised.notes[0].prompt).toBe(before.notes[0].prompt);
  expect(revised.notes[0].versions[0]).toEqual(before.notes[0].versions[0]);
  expect(revised.edges).toEqual(before.edges);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").first().click();
  await expect(page.getByLabel("Note version", { exact: true })).toHaveValue(
    before.notes[0].versions[0].id,
  );
  await expect(page.locator(".reader-response")).not.toContainText(
    "My corrected explanation",
  );
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(
    before.edges[0].highlight.text,
  );
  await page
    .getByLabel("Note version", { exact: true })
    .selectOption(revised.notes[0].versions[3].id);
  await page.locator(".reader-response strong").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    element
      .closest(".reader-response")!
      .dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page
    .getByRole("button", { name: "Explore this passage", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Follow the corrected passage");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".note-card")).toHaveCount(4);
  await expect.poll(async () => (await stored()).notes.length).toBe(4);
  const branched = await stored();
  expect(branched.edges[2].highlight.versionId).toBe(
    revised.notes[0].versions[3].id,
  );
  expect(branched.notes[3].versions[0].context[1].content).toBe(
    "Explain the revised question clearly",
  );
  expect(branched.notes[3].versions[0].context[2].content).toContain(
    "My corrected explanation",
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(4);
  await page.locator(".artefact-list button").first().click();
  await page
    .locator(".document-preview")
    .getByRole("button", { name: "Open source Note", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Note version", { exact: true })).toHaveValue(
    before.notes[0].versions[0].id,
  );
  await expect(page.locator(".reader h2").first()).toHaveText(
    before.notes[0].prompt,
  );
  await page
    .getByLabel("Note version", { exact: true })
    .selectOption(revised.notes[0].versions[3].id);
  await expect(page.locator(".reader-response")).toContainText(
    "My corrected explanation",
  );
});
