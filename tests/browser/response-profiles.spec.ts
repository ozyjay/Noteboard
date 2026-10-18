import { test, expect } from "@playwright/test";

test("Board profiles, request overrides and customisation preserve instructions after reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const readBoard = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("inquiry.boards")!)[0]);
  const original = await readBoard();
  await page.getByLabel("Board response profile").selectOption("evaluate");
  await expect
    .poll(async () => (await readBoard()).responseProfile)
    .toBe("evaluate");
  await page.reload();
  await expect(page.getByLabel("Board response profile")).toHaveValue(
    "evaluate",
  );
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
  const dialog = page.getByRole("dialog");
  const profile = dialog.getByLabel("Response profile", { exact: true });
  await expect(profile).toHaveValue("evaluate");
  await profile.selectOption("explore");
  await dialog
    .getByText("Customise instructions for this Note", { exact: true })
    .click();
  await expect(dialog.getByLabel("Request instructions")).toContainText(
    "Write coherent passages",
  );
  await dialog
    .getByLabel("Request instructions")
    .fill("My request-only instructions");
  await expect(profile).toHaveValue("custom");
  await profile.selectOption("direct");
  await expect(dialog.getByLabel("Request instructions")).toContainText(
    "# Response profile: Direct answer",
  );
  await page.screenshot({ path: testInfo.outputPath("response-profiles.png") });
  await dialog.getByLabel("Your question").fill("Explain emergence");
  await dialog
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await readBoard()).notes.length).toBe(4);
  const updated = await readBoard();
  expect(updated.responseProfile).toBe("evaluate");
  expect(updated.notes.slice(0, 3)).toEqual(original.notes);
  expect(updated.edges.slice(0, 2)).toEqual(original.edges);
  const context = updated.notes[3].versions[0].context;
  expect(context[0].content).toContain("# Response profile: Direct answer");
  expect(context[0].content).not.toContain("My request-only instructions");
  await page.reload();
  expect((await readBoard()).notes[3].versions[0].context).toEqual(context);
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Response profile", { exact: true }),
  ).toHaveValue("explore");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Board response profile")).toHaveValue(
    "explore",
  );
});
