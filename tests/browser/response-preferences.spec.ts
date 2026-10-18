import { test, expect } from "@playwright/test";

test("custom instructions save, cancel and persist in future generation records", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const readBoard = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("inquiry.boards")!)[0]);
  const original = await readBoard();
  await page.getByLabel("Board response profile").selectOption("custom");
  const openSettings = () =>
    page
      .getByRole("button", { name: "Provider settings", exact: true })
      .click();
  await openSettings();
  const dialog = page.getByRole("dialog", { name: "Provider settings" });
  const instructions = dialog.getByRole("textbox", {
    name: "Custom instructions",
    exact: true,
  });
  await expect(instructions).toContainText("Australian English");
  const initial = await instructions.inputValue();
  expect(initial).not.toContain("JCU");
  await instructions.fill("Unsaved preference");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await openSettings();
  await expect(instructions).toHaveValue(initial);
  const custom =
    "Lead with the answer.\nDistinguish evidence from assumptions.";
  await instructions.fill(custom);
  await instructions.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("custom-instructions.png"),
  });
  await dialog
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.reload();
  await openSettings();
  await expect(instructions).toHaveValue(custom);
  await dialog
    .getByRole("button", { name: "Restore response preferences", exact: true })
    .click();
  await expect(instructions).toHaveValue(initial);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: original.notes[0].prompt, exact: true })
    .click();
  await page.locator(".reader-response").evaluate((root) => {
    const range = document.createRange();
    range.selectNodeContents(root.querySelector("strong")!);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page
    .getByRole("button", { name: "Explore this passage", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Explain emergence naturally");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(async () => (await readBoard()).notes.length).toBe(4);
  const branched = await readBoard();
  expect(branched.notes.slice(0, 3)).toEqual(original.notes);
  expect(branched.notes[3].versions[0].context[0].content).toContain(custom);
  expect(branched.notes[3].versions[0].context.slice(1, 3)).toEqual([
    { role: "user", content: original.notes[0].prompt },
    { role: "assistant", content: original.notes[0].versions[0].text },
  ]);
  expect(JSON.stringify(branched.notes[3].versions[0].context)).not.toContain(
    original.notes[2].versions[0].text,
  );
  await page.getByRole("button", { name: "Back to Board" }).click();
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page
    .getByRole("button", { name: "Create artefact", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Synthesising your sources…",
  );
  await expect(page.locator(".stream-preview")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancel generation", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".document-preview")).toBeVisible();
  await expect.poll(async () => (await readBoard()).artefacts.length).toBe(1);
  expect(
    (await readBoard()).artefacts[0].versions[0].context[0].content,
  ).toContain(custom);
  await openSettings();
  await instructions.fill("");
  await dialog
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.reload();
  await openSettings();
  await expect(instructions).toHaveValue("");
  expect((await readBoard()).notes[3].versions[0].context).toEqual(
    branched.notes[3].versions[0].context,
  );
});
