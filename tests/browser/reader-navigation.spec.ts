import { test, expect } from "@playwright/test";

test("editable titles preserve prompts and connected notes navigate both ways after reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const readBoard = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("inquiry.boards")!)[0]);
  const original = await readBoard();
  await page
    .getByRole("button", { name: original.notes[0].prompt, exact: true })
    .click();
  const reader = page.locator(".reader");
  const navigation = reader.getByRole("navigation", {
    name: "Connected notes",
  });
  await expect(navigation).toContainText("This is the starting note.");
  await expect(navigation.getByRole("button")).toHaveCount(2);
  await reader
    .getByRole("button", { name: "Edit Note title", exact: true })
    .dblclick();
  const editor = reader.getByRole("textbox", {
    name: "Note title",
    exact: true,
  });
  await editor.fill("Systems overview");
  await editor.press("Escape");
  expect((await readBoard()).notes[0].title).toBeUndefined();
  await expect(
    reader.getByRole("heading", {
      name: original.notes[0].prompt,
      exact: true,
    }),
  ).toBeVisible();
  await reader
    .getByRole("button", { name: "Edit Note title", exact: true })
    .dblclick();
  await editor.fill("  Systems overview  ");
  await page.screenshot({ path: testInfo.outputPath("inline-note-title.png") });
  await editor.press("Enter");
  await expect(
    reader.getByRole("heading", { name: "Systems overview", exact: true }),
  ).toBeVisible();
  await expect(reader.locator(".original-prompt")).toContainText(
    original.notes[0].prompt,
  );
  await expect
    .poll(async () => (await readBoard()).notes[0].title)
    .toBe("Systems overview");
  const edited = await readBoard();
  expect(edited.notes[0]).toEqual({
    ...original.notes[0],
    title: "Systems overview",
  });
  expect(edited.edges).toEqual(original.edges);
  const title = reader.getByRole("button", {
    name: "Edit Note title",
    exact: true,
  });
  await title.click();
  await expect(editor).toHaveCount(0);
  await title.focus();
  await title.press("Enter");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("Systems overview");
  await editor.fill("Systems overview draft");
  await reader.locator(".original-prompt strong").click();
  await expect(
    reader.getByRole("heading", {
      name: "Systems overview draft",
      exact: true,
    }),
  ).toBeVisible();
  await title.dblclick();
  await editor.fill("Systems overview");
  await editor.press("Enter");
  await navigation
    .getByRole("button", { name: original.notes[1].prompt, exact: true })
    .click();
  await expect(navigation).toContainText("No subsequent notes yet.");
  await navigation
    .getByRole("button", { name: "Systems overview", exact: true })
    .click();
  await expect(reader.locator(".anchor-info")).toContainText(
    original.edges[0].highlight.text,
  );
  await navigation
    .getByRole("button", { name: original.notes[2].prompt, exact: true })
    .click();
  await expect(
    reader.getByRole("heading", {
      name: original.notes[2].prompt,
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Systems overview", exact: true })
    .click();
  await expect(
    reader.getByRole("heading", { name: "Systems overview", exact: true }),
  ).toBeVisible();
  await reader
    .getByRole("button", { name: "Edit Note title", exact: true })
    .dblclick();
  await editor.fill(" ");
  await editor.press("Enter");
  await expect(
    reader.getByRole("heading", {
      name: original.notes[0].prompt,
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readBoard()).notes[0].title)
    .toBeUndefined();
});

test("takeaway editing is collapsed and preserves the original response after reopening", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const readBoard = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("inquiry.boards")!)[0]);
  const original = await readBoard();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const editor = page.getByLabel("Edit Takeaway", { exact: true });
  await expect(editor).toBeHidden();
  await expect(page.locator(".reader-response")).toContainText(
    original.notes[0].takeaway,
  );
  const renderedResponse = await page.locator(".reader-response").textContent();
  await page.locator(".takeaway-controls summary").click();
  await expect(editor).toHaveValue(original.notes[0].takeaway);
  await editor.fill("Examine the relationships between the parts.");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const edited = await readBoard();
  expect(edited.notes[0].takeaway).toBe(
    "Examine the relationships between the parts.",
  );
  expect(edited.notes[0].versions).toEqual(original.notes[0].versions);
  expect(edited.edges).toEqual(original.edges);
  await expect(page.locator(".reader-response")).toHaveText(renderedResponse!);
  await page.reload();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await expect(editor).toBeHidden();
  await page.locator(".takeaway-controls summary").click();
  await expect(editor).toHaveValue(edited.notes[0].takeaway);
  await expect(page.locator(".reader-response")).toHaveText(renderedResponse!);
});
