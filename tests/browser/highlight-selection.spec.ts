import { test, expect } from "@playwright/test";

test("selects a repeated occurrence across rich formatting with exact offsets", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const selection = await page.locator(".reader-response").evaluate((root) => {
    const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const all: Text[] = [];
    while (texts.nextNode()) all.push(texts.currentNode as Text);
    const start = all.find((n) => n.data.includes("Their relationships"))!;
    const end = all.find((n) => n.data === "emergence")!;
    const range = document.createRange();
    range.setStart(start, start.data.indexOf("Their"));
    range.setEnd(end, end.length);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return range.toString();
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue(`What is ${selection}?`);
});

test("clearing a text selection reverts the Highlight controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const explore = page.getByRole("button", { name: "Explore this passage" });
  const footer = page.locator(".reader-footer");
  const selectPassage = async () => {
    await page.locator(".reader-response").evaluate((root) => {
      const range = document.createRange();
      range.selectNodeContents(root.querySelector("p")!);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await expect(explore).toBeVisible();
  };
  await selectPassage();
  await page.locator(".note-meta").click();
  await expect(explore).toHaveCount(0);
  await expect(footer).toHaveText(
    "Select a passage in the response to begin a new branch.",
  );

  await selectPassage();
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await expect(explore).toHaveCount(0);
  await expect(footer).toHaveText(
    "Select a passage in the response to begin a new branch.",
  );

  await selectPassage();
  await explore.click();
  const question = page.getByRole("textbox", { name: "Your question" });
  const prompt = await question.inputValue();
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await expect(question).toHaveValue(prompt);
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".note-card")).toHaveCount(4);
});

test("a new Studio Highlight branch displays its connection and reopens the source after reload", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("I want to make my own Tiny Language Model.");
  await page
    .getByRole("button", { name: "Ask & explore", exact: true })
    .click();
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Note style").selectOption("studio");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Provider settings", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Custom instructions", exact: true })
    .fill("Use Australian English. Answer concisely.");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.locator(".note-card .note-prompt").click();
  const passage = await page.locator(".reader-response").evaluate((root) => {
    const range = document.createRange();
    range.selectNodeContents(root.querySelector("p")!);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return range.toString();
  });
  await page
    .getByRole("button", { name: "Explore this passage", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What are some good ones to try?");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.locator(".note-card")).toHaveCount(2);
  await expect(page.locator(".edge-label")).toHaveText(passage);
  await expect(page.locator(".react-flow__edge-path")).toHaveCount(1);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  const label = page.locator(".edge-label");
  await expect(label).toHaveText(passage);
  // A horizontal SVG path has zero bounding-box height even with a visible stroke.
  await expect(page.locator(".react-flow__edge-path")).toHaveAttribute(
    "d",
    /^M/,
  );
  expect(
    (await page.locator(".react-flow__edge-path").boundingBox())!.width,
  ).toBeGreaterThan(0);
  await expect(label).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("studio-highlight-branch.png"),
  });
  await label.click();
  await expect(page.locator(".anchor-info")).toContainText(passage);
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(2);
  await label.click();
  await expect(page.locator(".anchor-info")).toContainText(passage);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(passage);
});

test("persists the second repeated passage using its rendered offsets", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem("inquiry.boards")!)[0];
    b.title = "Repeated passages";
    b.notes = b.notes.slice(0, 1);
    b.edges = [];
    b.artefacts = [];
    delete b.viewport;
    b.notes[0].prompt = "Repeated passages";
    b.notes[0].versions[0].text = "term and **term**";
    localStorage.setItem("inquiry.boards", JSON.stringify([b]));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Repeated passages", exact: true })
    .click();
  await page.locator(".reader-response").evaluate((root) => {
    const r = document.createRange();
    r.selectNodeContents(root.querySelector("strong")!);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(r);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const anchor = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].edges[0].highlight,
  );
  expect(anchor).toMatchObject({
    text: "term",
    start: 9,
    end: 13,
    surface: "rendered",
    renderedText: "term and term",
  });
  await page.getByRole("button", { name: "Close Note" }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").click();
  await expect(page.locator(".anchor-info")).toHaveText(
    "Source Highlight: “term”",
  );
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("term");
});
