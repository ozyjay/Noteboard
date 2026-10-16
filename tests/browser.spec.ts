import { test, expect } from "@playwright/test";
import { chatGPTExportFixture as importFixture } from "./fixtures/chatgpt-export";

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
  await expect(page.locator(".breadcrumb strong")).toHaveText(
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

test("edge labels wrap and reveal complete text with pointer and keyboard access", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  const passage =
    "A connection preserves the complete passage selected from its source, including details beyond the old character limit. "
      .repeat(30)
      .trim();
  await page.evaluate((text) => {
    const boards = JSON.parse(localStorage.getItem("inquiry.boards")!);
    const b = boards[0];
    b.notes = b.notes.slice(0, 2);
    b.edges = b.edges.slice(0, 1);
    const parent = b.notes[0];
    parent.versions[0].text = text;
    b.edges[0].highlight = {
      sourceId: parent.id,
      versionId: parent.versions[0].id,
      text,
      start: 0,
      end: text.length,
      surface: "markdown",
    };
    parent.position = { x: 80, y: 160 };
    b.notes[1].position = { x: 650, y: 160 };
    b.viewport = { x: 0, y: 0, zoom: 1 };
    localStorage.setItem("inquiry.boards", JSON.stringify(boards));
  }, passage);
  await page.reload();
  const label = page.locator(".edge-label");
  const preview = page.getByRole("region", { name: "Full connection text" });
  await expect(label).toHaveText(passage);
  const dimensions = await label.locator("span").evaluate((element) => ({
    height: element.clientHeight,
    lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    overflowing: element.scrollHeight > element.clientHeight,
  }));
  expect(dimensions.height).toBeCloseTo(dimensions.lineHeight * 2, 0);
  expect(dimensions.overflowing).toBe(true);
  await label.hover();
  await expect(preview.locator(".edge-preview-text")).toHaveText(passage);
  const bounds = await preview.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(8);
  expect(bounds!.y).toBeGreaterThanOrEqual(8);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440 - 8);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1000 - 8);
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("edge-preview.png") });
  await page.mouse.move(10, 10);
  await expect(preview).toHaveCount(0);
  await label.focus();
  await expect(preview).toBeVisible();
  await label.press("ArrowDown");
  await expect(preview).toBeFocused();
  await preview.press("End");
  await expect(
    preview.getByRole("button", { name: "Open source Note" }),
  ).toBeInViewport();
  await preview.press("Escape");
  await expect(label).toBeFocused();
  await expect(preview).toHaveCount(0);
  await label.press("Enter");
  await expect(page.locator(".reader-response")).toHaveText(passage);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(passage);
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  await page.reload();
  await label.click();
  await expect(page.locator(".reader-response")).toHaveText(passage);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(passage);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  const linePoint = await page
    .locator(".react-flow__edge-path")
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const point = path.getPointAtLength(25);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(
        path.getScreenCTM()!,
      );
      return { x: screen.x, y: screen.y };
    });
  await page.mouse.click(linePoint.x, linePoint.y);
  await expect(page.locator(".reader-response")).toHaveText(passage);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(passage);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Zoom out" }).click();
  await expect(label).toHaveClass(/edge-label-distant/);
  await label.focus();
  await expect(preview).toBeVisible();
  await expect(label).not.toHaveClass(/edge-label-distant/);
});

test("Note prompts send on Enter while preserving multiline and composed input", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  const prompt = page.getByRole("textbox", { name: "Your question" });
  await prompt.fill("   ");
  await prompt.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".note-card")).toHaveCount(0);
  await prompt.fill("First line");
  await prompt.press("End");
  await prompt.press("Shift+Enter");
  await prompt.pressSequentially("Second line");
  await expect(prompt).toHaveValue("First line\nSecond line");
  await prompt.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.locator(".note-card")).toHaveCount(0);
  await prompt.press("Enter");
  await expect(prompt).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText(
    "Generating your response…",
  );
  await expect(page.locator(".stream-preview")).toHaveCount(0);
  await expect(page.locator(".note-card")).toHaveCount(1);
  await expect(page.locator(".reader h2").first()).toHaveText(
    "First line\nSecond line",
  );
  await expect(page.locator(".reader-response")).toContainText(
    "Where this fits",
  );
  await expect(page.locator(".reader-response")).toContainText("Takeaway:");
  await expect(page.locator(".note-takeaway")).not.toContainText(
    "Where this fits",
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "First line Second line", exact: true })
    .click();
  await expect(page.locator(".reader-response")).toContainText(
    "Where this fits",
  );
});

test("ChatGPT import previews paths, cancels and rejects unsupported input", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Import ChatGPT conversation", exact: true })
    .click();
  await page.getByLabel("ChatGPT export file").setInputFiles({
    name: "conversations.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importFixture)),
  });
  await page.getByLabel("Search conversations").fill("café");
  await page.getByLabel("Conversation", { exact: true }).selectOption("0");
  await expect(page.getByLabel("Conversation path")).toHaveValue("a2");
  await expect(page.locator(".import-preview")).toContainText(
    "1 system/developer records excluded",
  );
  await page.getByLabel("Conversation path").selectOption("a2-alt");
  await expect(page.locator(".import-preview")).toContainText(
    "The exponent is two.",
  );
  await expect(page.locator(".import-preview")).not.toContainText(
    "It is the second occurrence.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Import ChatGPT conversation", exact: true })
    .click();
  const invalid = structuredClone(importFixture);
  invalid[0].mapping.a2.message!.content.content_type = "multimodal_text";
  await page.getByLabel("ChatGPT export file").setInputFiles({
    name: "conversations.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await page.getByLabel("Conversation", { exact: true }).selectOption("0");
  await expect(page.getByLabel("Conversation path")).toHaveValue("");
  await page.getByLabel("Conversation path").selectOption("a2");
  await expect(page.getByRole("alert")).toContainText("only text is supported");
  await expect(
    page.getByRole("button", { name: "Import conversation", exact: true }),
  ).toBeDisabled();
});

test("imported chains retain retrospective anchors, branching context and synthesis sources after reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import ChatGPT conversation", exact: true })
    .click();
  await page.getByLabel("ChatGPT export file").setInputFiles({
    name: "conversations.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importFixture)),
  });
  await page.getByLabel("Conversation", { exact: true }).selectOption("0");
  await page.screenshot({
    path: testInfo.outputPath("chatgpt-import-preview.png"),
  });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function (key, value) {
      if (
        fail &&
        key === "inquiry.boards" &&
        value.includes("Imported café conversation")
      ) {
        fail = false;
        throw new Error("Simulated local save failure");
      }
      return original.call(this, key, value);
    };
  });
  await page
    .getByRole("button", { name: "Import conversation", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "preview is retained for retry",
  );
  await expect(page.locator(".note-card")).toHaveCount(3);
  await expect(page.locator(".import-preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Import conversation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".note-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Explain café systems", exact: true })
    .click();
  await expect(page.locator(".reader-scroll")).toContainText(
    "Imported from ChatGPT",
  );
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("inquiry.boards")!).find(
        (b: { title: string }) => b.title === "Imported café conversation",
      ),
    );
  const before = await stored();
  const selectTerm = async () =>
    page.locator(".reader-response").evaluate((root) => {
      const range = document.createRange();
      range.selectNodeContents(root.querySelector("strong")!);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
  await selectTerm();
  await page
    .getByRole("button", {
      name: "Attach Highlight to imported follow-up",
      exact: true,
    })
    .click();
  await expect(page.locator(".existing-branches")).toContainText(
    "Retrospective Highlight: term",
  );
  const annotated = await stored();
  expect(annotated.notes).toEqual(before.notes);
  expect(annotated.edges[0].highlight.start).toBe(15); // second occurrence in rendered text
  await page.locator(".reader-response").evaluate((root) => {
    const range = document.createRange();
    range.selectNodeContents(root.querySelector(".katex")!);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page
    .getByRole("button", {
      name: "Attach Highlight to imported follow-up",
      exact: true,
    })
    .click();
  expect((await stored()).edges[0].highlight.latexSources).toEqual(["x^2"]);
  expect((await stored()).notes).toEqual(before.notes);
  await selectTerm();
  await page
    .getByRole("button", {
      name: "Attach Highlight to imported follow-up",
      exact: true,
    })
    .click();

  await page.reload();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").click();
  await expect(page.locator(".anchor-info")).toContainText("term");
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("term");
  await page
    .getByRole("button", {
      name: "Remove retrospective Highlight for Explain the second term",
    })
    .click();
  expect((await stored()).edges[0].highlight).toBeUndefined();
  await selectTerm();
  await page
    .getByRole("button", {
      name: "Attach Highlight to imported follow-up",
      exact: true,
    })
    .click();
  await page
    .getByRole("navigation", { name: "Connected notes" })
    .getByRole("button", { name: "Explain the second term", exact: true })
    .click();
  await page.locator(".reader-response").evaluate((root) => {
    const range = document.createRange();
    range.selectNodeContents(root);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page
    .getByRole("button", { name: "Explore this passage", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Continue this imported exploration");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const branched = await stored();
  expect(branched.notes[2].versions[0].context.slice(1, 5)).toEqual([
    { role: "user", content: before.notes[0].prompt },
    { role: "assistant", content: before.notes[0].versions[0].text },
    { role: "user", content: before.notes[1].prompt },
    { role: "assistant", content: before.notes[1].versions[0].text },
  ]);
  expect(
    branched.notes[2].versions[0].context
      .map((m: { content: string }) => m.content)
      .join("\n"),
  ).not.toContain("Original private instructions");
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page
    .getByRole("button", { name: "Create artefact", exact: true })
    .click();
  await expect(page.locator(".document-preview")).toContainText(
    "Imported continuation.",
  );
  await expect(page.locator(".document-preview")).toContainText(
    "Retrospective Highlight",
  );
  await page
    .getByRole("button", { name: "Open source Note", exact: true })
    .first()
    .click();
  await expect(page.locator(".reader h2").first()).toHaveText(
    "Explain café systems",
  );
  await page.screenshot({ path: testInfo.outputPath("imported-chain.png") });
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  expect((await stored()).edges[0].highlight).toEqual(
    annotated.edges[0].highlight,
  );
});
test("custom instructions save, cancel and persist in future generation records", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const readBoard = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("inquiry.boards")!)[0]);
  const original = await readBoard();
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

test("maths survives equation branching, synthesis editing and reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("monospace");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const source =
    String.raw`# Energy

**First** $E=mc^2$ then **second** $E=mc^2$.

\[\frac{1}{2}mv^2\]
` + "\nLiteral code: `$x$`.";
  await page.evaluate((text) => {
    const b = JSON.parse(localStorage.getItem("inquiry.boards")!)[0];
    b.notes = b.notes.slice(0, 1);
    b.edges = [];
    b.artefacts = [];
    b.notes[0].prompt = "Maths response";
    b.notes[0].versions[0].text = text;
    localStorage.setItem("inquiry.boards", JSON.stringify([b]));
  }, source);
  await page.reload();
  await page
    .getByRole("button", { name: "Maths response", exact: true })
    .click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(3);
  await expect(page.locator(".reader-response code")).toHaveText("$x$");
  await page.locator(".reader-response").evaluate((root) => {
    const equation = root.querySelectorAll(".katex")[1];
    const range = document.createRange();
    range.selectNodeContents(equation);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue(String.raw`What is \(E=mc^2\)?`);
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Explain this equation");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("inquiry.boards")!)[0],
  );
  expect(saved.edges[0].highlight.latexSources).toEqual(["E=mc^2"]);
  expect(saved.edges[0].highlight.start).toBeGreaterThan(
    saved.edges[0].highlight.renderedText.indexOf("second"),
  );
  expect(saved.notes[1].versions[0].context.at(-1).content).toContain(
    String.raw`\[E=mc^2\]`,
  );
  expect(saved.notes[0].versions[0].text).toBe(source);
  await page.reload();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(3);
  expect(
    await page.evaluate(() => getSelection()?.getRangeAt(0).toString()),
  ).toBe(saved.edges[0].highlight.text);
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page.getByLabel("Output", { exact: true }).selectOption("journey");
  await page.getByRole("button", { name: "Create artefact" }).click();
  await expect(page.locator(".document-preview .katex")).toHaveCount(4);
  await expect(
    page.locator(".document-preview h1").filter({ hasText: "Energy" }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("maths-synthesis.png") });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Synthesis document" });
  await editor.fill((await editor.inputValue()) + "\n\nReviewed $a^2$.");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await page.locator(".artefact-list button").first().click();
  await expect(page.locator(".document-preview .katex")).toHaveCount(5);
  await page
    .locator(".document-preview")
    .getByRole("button", { name: "Open source Note" })
    .first()
    .click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(3);
});
test("older rendered Highlights retain their exact surface with maths enabled", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem("inquiry.boards")!)[0];
    b.notes = b.notes.slice(0, 2);
    b.edges = b.edges.slice(0, 1);
    b.artefacts = [];
    delete b.viewport;
    b.notes[0].versions[0].text = "term $x^2$ term";
    b.edges[0].highlight = {
      sourceId: b.notes[0].id,
      versionId: b.notes[0].versions[0].id,
      text: "term",
      start: 11,
      end: 15,
      surface: "rendered",
      renderedText: "term $x^2$ term",
    };
    localStorage.setItem("inquiry.boards", JSON.stringify([b]));
  });
  await page.reload();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(0);
  expect(
    await page.evaluate(() => getSelection()?.getRangeAt(0).toString()),
  ).toBe("term");
  await page.getByRole("button", { name: "Close Note" }).click();
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await expect(page.locator(".reader-response .katex")).toHaveCount(1);
});
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
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
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

test("manual placement survives reopening the Board", async ({ page }) => {
  await page.goto("/");
  const label = page.locator(".note-number").first();
  await label.click();
  const box = (await label.boundingBox())!;
  const initial = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0].position,
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 90,
    box.y + box.height / 2 + 60,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
            .position.x,
      ),
    )
    .toBeGreaterThan(initial.x + 20);
  const placed = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0].position,
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
          .position,
    ),
  ).toEqual(placed);
});

test("ChatGPT per-Note model and effort overrides preserve defaults and context after reopening", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const listeners = new Set<(event: { id: string; text: string }) => void>();
    let connected = localStorage.getItem("test.connected") === "true";
    const accounts = () => [
      {
        id: "test-client",
        label: "Test account · client",
        connected,
        planEnabled: connected,
      },
    ];
    window.inquiry = {
      openWebLink: async (url) => {
        localStorage.setItem("test.opened-source", url);
      },
      deleteBoard: async (id) => {
        const boards = JSON.parse(localStorage.getItem("test.boards") || "[]");
        localStorage.setItem(
          "test.boards",
          JSON.stringify(boards.filter((b: { id: string }) => b.id !== id)),
        );
      },
      listBoards: async () =>
        JSON.parse(localStorage.getItem("test.boards") || "[]"),
      saveBoard: async (board) => {
        const boards = JSON.parse(localStorage.getItem("test.boards") || "[]");
        const values = [
          board,
          ...boards.filter((value: { id: string }) => value.id !== board.id),
        ];
        values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        localStorage.setItem("test.boards", JSON.stringify(values));
      },
      getSettings: async () =>
        JSON.parse(
          localStorage.getItem("test.settings") ||
            '{"provider":"demo","endpoint":"http://127.0.0.1:11434","model":"","contextLimit":8192,"depthReminder":8}',
        ),
      saveSettings: async (settings) => {
        localStorage.setItem("test.settings", JSON.stringify(settings));
      },
      chatgptAccounts: async () => accounts(),
      chatgptSignIn: async () => {
        connected = true;
        localStorage.setItem("test.connected", "true");
        return accounts();
      },
      chatgptCancelSignIn: async () => {},
      chatgptSignOut: async () => {
        connected = false;
        localStorage.removeItem("test.connected");
        return { revoked: true };
      },
      chatgptUsage: async () => {
        localStorage.setItem("test.usage", "opened");
      },
      models: async () => {
        localStorage.setItem(
          "test.model-discoveries",
          String(
            Number(localStorage.getItem("test.model-discoveries") || 0) + 1,
          ),
        );
        return [
          { id: "test-chatgpt-model", name: "Test ChatGPT Model" },
          { id: "test-other-model", name: "Another ChatGPT Model" },
        ];
      },
      generate: async (req) => {
        if (req.messages.some((message) => message.role === "system"))
          throw new Error("Unexpected system message");
        localStorage.setItem("test.request", JSON.stringify(req));
        if (localStorage.getItem("test.fail"))
          throw new Error("The selected thinking effort is unavailable");
        if (req.purpose === "explore" && req.messages.length > 2) {
          await new Promise<void>((resolve) => {
            window.addEventListener("test:finish-generation", () => resolve(), {
              once: true,
            });
          });
        }
        const text =
          req.purpose === "explore"
            ? "## Example\n\nConnected ideas can support an inquiry. [source]\n\nTakeaway: Follow connected ideas."
            : `# Explanation\n\nSelected Notes brought together.\n\n[Source Note](inquiry://note/${req.messages[1].content.match(/<note id="([^"]+)"/)?.[1]})`;
        listeners.forEach((listener) => listener({ id: req.id, text }));
        return {
          text,
          model: req.settings.model,
          reasoningEffort: req.settings.reasoningEffort,
          ...(req.purpose === "explore"
            ? {
                webResearch: {
                  requested: Boolean(req.settings.webSearch),
                  searched: Boolean(req.settings.webSearch),
                  calls: req.settings.webSearch
                    ? [
                        {
                          id: "search-1",
                          status: "completed",
                          action: {
                            type: "search",
                            queries: ["connected ideas"],
                          },
                        },
                      ]
                    : [],
                  citations: req.settings.webSearch
                    ? [
                        {
                          start: text.indexOf("[source]"),
                          end: text.indexOf("[source]") + 8,
                          url: "https://example.org/evidence",
                          title: "Evidence source",
                        },
                      ]
                    : [],
                },
              }
            : {}),
          usage: { input: 10, output: 5 },
        };
      },
      cancel: async () => {},
      onDelta: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Provider settings", exact: true })
    .click();
  await page.getByLabel("Provider", { exact: true }).selectOption("chatgpt");
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT" }),
  ).toBeVisible();
  await page
    .getByLabel("ChatGPT account", { exact: true })
    .selectOption("test-client");
  await page.getByRole("button", { name: "Manage usage", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("test.usage"))).toBe(
    "opened",
  );
  await page
    .getByRole("button", { name: "Continue with ChatGPT", exact: true })
    .click();
  await expect(
    page.getByText("You’re using your ChatGPT plan", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(
    page.getByLabel("Model", { exact: true }).locator("option"),
  ).toHaveCount(3);
  expect(
    await page.evaluate(() => localStorage.getItem("test.model-discoveries")),
  ).toBe("1");
  await page
    .getByRole("button", { name: "Refresh models", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("test.model-discoveries")),
    )
    .toBe("2");
  await page
    .getByLabel("Model", { exact: true })
    .selectOption({ label: "Test ChatGPT Model" });
  await page
    .getByLabel("Thinking effort", { exact: true })
    .selectOption("high");
  await page.screenshot({ path: "/tmp/noteboard-chatgpt-settings.png" });
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await expect(page.getByLabel("Note model", { exact: true })).toHaveValue(
    "test-chatgpt-model",
  );
  await expect(
    page.getByLabel("Note thinking effort", { exact: true }),
  ).toHaveValue("high");
  await expect(
    page.getByLabel("Note model", { exact: true }).locator("option"),
  ).toHaveCount(2);
  expect(
    await page.evaluate(() => localStorage.getItem("test.model-discoveries")),
  ).toBe("2");
  await page
    .getByLabel("Note model", { exact: true })
    .selectOption({ label: "Another ChatGPT Model" });
  await expect(
    page.getByLabel("Note thinking effort", { exact: true }),
  ).toHaveValue("");
  await page
    .getByLabel("Note thinking effort", { exact: true })
    .selectOption("medium");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("My ChatGPT inquiry");
  await expect(
    page.getByRole("checkbox", { name: "Allow web search", exact: true }),
  ).toBeChecked();
  await page.getByLabel("Attach files", { exact: true }).setInputFiles({
    name: "blocked.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("unsupported"),
  });
  await expect(
    page.locator(".research-inputs").getByRole("alert"),
  ).toContainText("Unsupported file type");
  await page.getByLabel("Attach files", { exact: true }).setInputFiles({
    name: "reference.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Reference facts."),
  });
  await expect(
    page.getByRole("button", { name: "Remove reference.txt", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Using ChatGPT plan", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("note-model-and-effort.png"),
  });
  await page.evaluate(() => localStorage.setItem("test.fail", "true"));
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(page.locator(".composer").getByRole("alert")).toContainText(
    "The selected thinking effort is unavailable",
  );
  await expect(page.getByLabel("Note model", { exact: true })).toHaveValue(
    "test-other-model",
  );
  await expect(
    page.getByLabel("Note thinking effort", { exact: true }),
  ).toHaveValue("medium");
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue("My ChatGPT inquiry");
  await expect(page.locator(".note-card")).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem("test.fail"));
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(page.locator(".note-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "My ChatGPT inquiry", exact: true })
    .click();
  await expect(page.locator(".reader-response")).toBeVisible();
  await page
    .getByRole("button", { name: "Regenerate response", exact: true })
    .click();
  await expect(page.getByLabel("Revision model").locator("option")).toHaveCount(
    2,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("test.model-discoveries")),
  ).toBe("2");
  await page.getByRole("button", { name: "Close Note revision" }).click();
  await expect(page.locator(".research-record")).toContainText(
    "Web search used",
  );
  await expect(page.locator(".research-record")).toContainText("reference.txt");
  await page
    .locator(".reader-response")
    .getByRole("button", { name: "[1]", exact: true })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("test.opened-source")),
  ).toBe("https://example.org/evidence");
  await page.locator(".reader-response").evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const start = node.textContent?.indexOf("Connected ideas") ?? -1;
      if (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + "Connected ideas".length);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        break;
      }
    }
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toBeFocused();
  await expect(page.getByLabel("Note model", { exact: true })).toHaveValue(
    "test-chatgpt-model",
  );
  await expect(
    page.getByLabel("Note thinking effort", { exact: true }),
  ).toHaveValue("high");
  await expect(
    page.getByLabel("Note model", { exact: true }).locator("option"),
  ).toHaveCount(2);
  expect(
    await page.evaluate(() => localStorage.getItem("test.model-discoveries")),
  ).toBe("2");
  await page
    .getByLabel("Note model", { exact: true })
    .selectOption("test-other-model");
  await expect(
    page.getByLabel("Note thinking effort", { exact: true }),
  ).toHaveValue("");
  await page
    .getByLabel("Note thinking effort", { exact: true })
    .selectOption("low");
  await expect(page.locator(".research-inputs")).toContainText(
    "Retained files: reference.txt",
  );
  await page
    .getByRole("checkbox", { name: "Allow web search", exact: true })
    .uncheck();
  await page.getByLabel("Attach files", { exact: true }).setInputFiles({
    name: "data.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("item,value\na,1"),
  });
  await expect(
    page.getByRole("button", { name: "Remove data.csv", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  const cancelGeneration = page.getByRole("button", {
    name: "Cancel generation",
    exact: true,
  });
  await expect(cancelGeneration).toBeFocused();
  await expect(page.getByLabel("Note model", { exact: true })).toBeDisabled();
  await expect(
    page.getByLabel("Note thinking effort", { exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Manage usage", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancelGeneration).toBeFocused();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("test:finish-generation"));
  });
  await expect(page.locator(".note-card")).toHaveCount(2);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("test.boards") || "[]"),
  );
  const child = saved[0].notes.at(-1);
  expect(child.versions[0].provider).toBe("chatgpt");
  expect(child.versions[0].model).toBe("test-other-model");
  expect(child.versions[0].reasoningEffort).toBe("low");
  expect(child.versions[0].files[0].name).toBe("data.csv");
  expect(child.versions[0].context[1].files[0].name).toBe("reference.txt");
  expect(child.versions[0].context.at(-1).files[0].name).toBe("data.csv");
  expect(saved[0].notes[0].versions[0].webResearch.searched).toBe(true);
  expect(child.versions[0].webResearch.requested).toBe(false);
  expect(saved[0].notes[0].versions[0].model).toBe("test-other-model");
  expect(saved[0].notes[0].versions[0].reasoningEffort).toBe("medium");
  const request = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("test.request")!),
  );
  expect(request.settings.model).toBe("test-other-model");
  expect(request.settings.reasoningEffort).toBe("low");
  expect(child.versions[0].context[0].content).toContain(
    'a "Where this fits" section is optional',
  );
  expect(
    child.versions[0].context.map((message: { role: string }) => message.role),
  ).toEqual(["developer", "user", "assistant", "user"]);
  expect(child.versions[0].context).toEqual(
    (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("test.request") || "{}"),
      )
    ).messages,
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(2);
  const reopened = await page.evaluate(
    () => JSON.parse(localStorage.getItem("test.boards")!)[0],
  );
  expect(reopened.notes[1].versions[0].model).toBe("test-other-model");
  expect(reopened.notes[1].versions[0].reasoningEffort).toBe("low");
  expect(reopened.notes[1].versions[0].files).toEqual(child.versions[0].files);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("test.settings")!).model,
    ),
  ).toBe("test-chatgpt-model");
  await expect(page.getByText("ChatGPT plan", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("test.settings") || "{}")
          .reasoningEffort,
    ),
  ).toBe("high");
  await page.getByRole("button", { name: "Consolidate", exact: true }).click();
  await page
    .getByRole("button", { name: "Create artefact", exact: true })
    .click();
  await expect(page.locator(".document-preview")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("test.boards") || "[]")[0].artefacts.at(
          -1,
        ).versions[0].reasoningEffort,
    ),
  ).toBe("high");
  await page
    .locator(".document-preview")
    .getByRole("button", { name: "Source Note", exact: true })
    .first()
    .click();
  await expect(page.locator(".reader h2").first()).toHaveText(
    "My ChatGPT inquiry",
  );

  await page
    .getByRole("button", { name: "Provider settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByText("Signed out of this ChatGPT account."),
  ).toBeVisible();
});

test("appearance previews, cancels, saves and follows system changes after reopening", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.getByLabel("Note style").selectOption("sticky");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "sticky",
  );
  await page.getByLabel("Accent colour").selectOption("blue");
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("serif");
  await expect(page.locator("html")).toHaveAttribute(
    "data-interface-font",
    "monospace",
  );
  expect(
    await page
      .locator(".brand")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Consolas");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "classic",
  );
  await expect(page.locator("html")).toHaveAttribute("data-accent", "sage");
  await expect(page.locator("html")).toHaveAttribute(
    "data-interface-font",
    "standard",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-font",
    "sans",
  );
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Theme", { exact: true }).selectOption("system");
  await page.getByLabel("Note style").selectOption("sticky");
  await page.getByLabel("Accent colour").selectOption("plum");
  await page.getByLabel("Reading text size").selectOption("larger");
  await page.getByLabel("Show canvas grid").uncheck();
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("monospace");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "plum");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "sticky",
  );
  expect(
    await page
      .locator(".note-card")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").pointerEvents),
  ).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("sticky-light.png") });
  await expect(page.locator("html")).toHaveAttribute(
    "data-text-size",
    "larger",
  );
  await expect(page.locator(".react-flow__background")).toHaveCount(0);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("dark-appearance.png") });
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  expect(
    await page
      .locator(".reader-response")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThan(18);
  await page.screenshot({
    path: testInfo.outputPath("dark-expanded-note.png"),
  });
  expect(
    await page
      .locator(".reader-response")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Consolas");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("inquiry.settings")!),
  );
  expect(stored.provider).toBe("demo");
  expect(stored.appearance).toEqual({
    noteStyle: "sticky",
    theme: "system",
    accent: "plum",
    textSize: "larger",
    showGrid: false,
    interfaceFont: "monospace",
    readingFont: "monospace",
  });
  await page
    .getByRole("button", { name: "Appearance settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset defaults" }).click();
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".react-flow__background")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "classic",
  );
});

for (const style of ["sticky", "blueprint", "index", "studio"] as const) {
  test(`${style} style previews, saves and supports light/dark reading`, async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(page.locator(".note-card")).toHaveCount(3);
    const original = await page.evaluate(() => {
      const { notes, edges, artefacts } = JSON.parse(
        localStorage.getItem("inquiry.boards")!,
      )[0];
      return { notes, edges, artefacts };
    });
    await page
      .getByRole("button", { name: "Appearance settings", exact: true })
      .click();
    await page.getByLabel("Note style").selectOption(style);
    await expect(page.locator("html")).toHaveAttribute(
      "data-note-style",
      style,
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-note-style",
      "classic",
    );
    for (const theme of ["light", "dark"]) {
      await page
        .getByRole("button", { name: "Appearance settings", exact: true })
        .click();
      await page.getByLabel("Note style").selectOption(style);
      await page.getByLabel("Theme", { exact: true }).selectOption(theme);
      await page.getByLabel("Show canvas grid").uncheck();
      await page
        .getByRole("button", { name: "Save appearance", exact: true })
        .click();
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute(
        "data-note-style",
        style,
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".react-flow__background")).toHaveCount(0);
      await page
        .getByRole("checkbox", { name: "Select Note 1 for synthesis" })
        .check();
      await expect(page.locator(".note-card.chosen")).toHaveCount(1);
      if (style === "blueprint") {
        const peek = page.locator(".note-card").first().locator(".note-peek");
        const collapsedHeight = (await page
          .locator(".note-card")
          .first()
          .boundingBox())!.height;
        await expect(peek.locator(".note-takeaway")).toBeHidden();
        await peek.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(peek.locator(".note-takeaway")).toBeVisible();
        expect(
          (await page.locator(".note-card").first().boundingBox())!.height,
        ).toBeGreaterThan(collapsedHeight);
        await expect(page.locator(".reader")).toHaveCount(0);
        await page.keyboard.press("Enter");
        await expect(peek.locator(".note-takeaway")).toBeHidden();
      }
      if (style === "studio") {
        const footer = page
          .locator(".note-card")
          .first()
          .locator(".note-bottom");
        expect(
          (await footer.getByRole("button").boundingBox())!.width,
        ).toBeCloseTo((await footer.boundingBox())!.width, 0);
      }
      await page.screenshot({
        path: testInfo.outputPath(`${style}-${theme}.png`),
      });
      await page
        .getByRole("button", {
          name: "How do complex systems work?",
          exact: true,
        })
        .click();
      await expect(page.locator(".reader-response")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`${style}-${theme}-reader.png`),
      });
      if (style === "sticky" || style === "studio") {
        await expect(page.getByLabel("Note version")).toBeHidden();
        await page.locator(".reader-tools summary").click();
      }
      await expect(page.getByLabel("Note version")).toBeVisible();
      const navigation = page.getByRole("navigation", {
        name: "Connected notes",
      });
      await navigation
        .getByRole("button", { name: "What is emergence?", exact: true })
        .click();
      await expect(page.locator(".reader h2").first()).toHaveText(
        "What is emergence?",
      );
      await navigation
        .getByRole("button", {
          name: "How do complex systems work?",
          exact: true,
        })
        .click();
      await expect(page.locator(".anchor-info")).toContainText("emergence");
      await page
        .getByRole("button", { name: "Close Note", exact: true })
        .click();
    }
    expect(
      await page.evaluate(() => {
        const { notes, edges, artefacts } = JSON.parse(
          localStorage.getItem("inquiry.boards")!,
        )[0];
        return { notes, edges, artefacts };
      }),
    ).toEqual(original);
  });
}

test("Note reader resizes by dragging and keyboard and keeps its width after expanding", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const reader = page.locator(".reader");
  const handle = page.getByRole("separator", { name: "Resize Note reader" });
  const source = await page.locator(".reader-response").textContent();
  const original = (await reader.boundingBox())!;
  const workspace = (await page.locator(".exploration").boundingBox())!;
  expect(original.width).toBeCloseTo(workspace.width / 3, 0);
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x - 180, grip.y + grip.height / 2, { steps: 8 });
  await page.mouse.up();
  const wider = (await reader.boundingBox())!.width;
  expect(wider).toBeGreaterThan(original.width + 170);
  await expect(reader).not.toHaveClass(/reader-resizing/);
  await expect(page.locator(".reader-response")).toHaveText(source!);
  await handle.focus();
  await handle.press("ArrowRight");
  expect((await reader.boundingBox())!.width).toBe(wider - 32);
  const resized = (await reader.boundingBox())!.width;
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  await expect(handle).toHaveCount(0);
  await page
    .getByRole("button", { name: "Collapse Note", exact: true })
    .click();
  expect((await reader.boundingBox())!.width).toBe(resized);
  await page.screenshot({
    path: testInfo.outputPath("resized-note-reader.png"),
  });
  await handle.focus();
  await handle.press("Home");
  expect((await reader.boundingBox())!.width).toBe(320);
  await handle.press("End");
  expect(
    (await page.locator(".canvas").boundingBox())!.width,
  ).toBeGreaterThanOrEqual(239);
  await page.setViewportSize({ width: 900, height: 800 });
  await expect
    .poll(async () => {
      const panel = (await reader.boundingBox())!;
      const workspace = (await page.locator(".exploration").boundingBox())!;
      return panel.width < workspace.width && panel.x >= workspace.x;
    })
    .toBe(true);
  await expect(page.locator(".reader-response")).toHaveText(source!);
});

test("expanded Note fills the workspace and retains passage navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const sourceText = await page.locator(".reader-response").textContent();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  const reader = (await page.locator(".reader").boundingBox())!;
  const body = (await page.locator(".exploration").boundingBox())!;
  expect(reader.width).toBe(body.width);
  expect(reader.height).toBe(body.height);
  await expect(page.locator(".reader-response")).toHaveText(sourceText!);
  await page.screenshot({ path: testInfo.outputPath("expanded-note.png") });
  await page
    .getByRole("button", { name: "Collapse Note", exact: true })
    .click();
  expect((await page.locator(".reader").boundingBox())!.width).toBeLessThan(
    body.width,
  );
  await page.getByRole("button", { name: "Close Note" }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").first().click();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  expect(await page.evaluate(() => getSelection()?.toString())).not.toBe("");
  await page.locator(".reader-response").evaluate((root) => {
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(
    page.getByRole("button", { name: "Explore this passage" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue(/^What is /);
});

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
  await page.getByRole("button", { name: "Delete Board", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".artefact-list button")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete Board", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Board permanently", exact: true })
    .click();
  await expect(page.locator(".board-heading h1")).toHaveText(
    "Untitled inquiry",
  );
  await expect(page.locator(".artefact-list button")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".board-heading h1")).toHaveText(
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
  await page.getByRole("button", { name: "Delete Board", exact: true }).click();
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
  await expect(page.locator(".board-heading h1")).toHaveText(
    "Untitled inquiry",
  );
});

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

test("revision model choices, failed requests and cancellation preserve the original", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const cancelled = new Set<string>();
    window.inquiry = {
      chatgptAccounts: async () => [],
      chatgptSignIn: async () => [],
      chatgptCancelSignIn: async () => {},
      chatgptSignOut: async () => ({ revoked: true }),
      chatgptUsage: async () => {},
      deleteBoard: async () => {},
      saveSettings: async () => {},
      onDelta: () => () => {},
      listBoards: async () =>
        JSON.parse(localStorage.getItem("mock.boards") || "[]"),
      saveBoard: async (board) => {
        localStorage.setItem("mock.boards", JSON.stringify([board]));
      },
      getSettings: async () => ({
        provider: "ollama",
        endpoint: "http://127.0.0.1:11434",
        model: "local-a",
        reasoningEffort: "high",
        customInstructions: "",
        appearance: {
          noteStyle: "classic",
          theme: "light",
          accent: "sage",
          textSize: "standard",
          showGrid: true,
          interfaceFont: "standard",
          readingFont: "sans",
        },
        contextLimit: 8192,
        depthReminder: 8,
      }),
      models: async () => [
        { id: "local-a", name: "Model A" },
        { id: "local-b", name: "Model B" },
      ],
      generate: async (req) => {
        localStorage.setItem("mock.request", JSON.stringify(req));
        if (localStorage.getItem("mock.fail"))
          throw new Error("Simulated model failure");
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (cancelled.has(req.id)) throw new Error("Generation cancelled");
        return { text: "A completed replacement.", model: req.settings.model };
      },
      cancel: async (id) => {
        cancelled.add(id);
      },
    };
  });
  await page.goto("/");
  await page.locator(".note-card .note-prompt").first().click();
  await page
    .getByRole("button", { name: "Regenerate response", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Regenerate response",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Discover models", exact: true })
    .click();
  await dialog.getByLabel("Revision model").selectOption({ label: "Model B" });
  await dialog
    .getByRole("button", { name: "Generate new version", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByLabel("Note version", { exact: true }).locator("option"),
  ).toHaveCount(2);
  const request = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mock.request")!),
  );
  expect(request.settings.model).toBe("local-b");
  expect(request.settings.reasoningEffort).toBeUndefined();
  expect(request.messages).toHaveLength(2);
  await page.evaluate(() => localStorage.setItem("mock.fail", "true"));
  await page
    .getByRole("button", { name: "Edit prompt and regenerate", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Edit prompt and regenerate",
    exact: true,
  });
  await dialog.getByLabel("Revised prompt").fill("x".repeat(29000));
  await dialog
    .getByRole("button", { name: "Generate new version", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "No history has been removed",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("mock.request")!).id,
    ),
  ).toBe(request.id);
  await dialog
    .getByLabel("Revised prompt")
    .fill("Keep this draft after failure");
  await dialog
    .getByRole("button", { name: "Generate new version", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Simulated model failure",
  );
  await expect(dialog.getByLabel("Revised prompt")).toHaveValue(
    "Keep this draft after failure",
  );
  await expect(
    page.getByLabel("Note version", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await page.evaluate(() => localStorage.removeItem("mock.fail"));
  await dialog
    .getByRole("button", { name: "Generate new version", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("cancelled");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByLabel("Note version", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await expect(page.locator(".reader-response")).toHaveText(
    "A completed replacement.",
  );
  const beforeReview = await page.evaluate(
    () => JSON.parse(localStorage.getItem("mock.boards")!)[0],
  );
  await page
    .getByRole("button", { name: "Sanity check & improve", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Sanity check & improve",
    exact: true,
  });
  const review = dialog.getByRole("textbox", {
    name: "Improvement prompt",
    exact: true,
  });
  await expect(review).toBeFocused();
  await expect(review).toHaveValue(/Sanity-check your preceding response/);
  await review.fill(
    "Check assumptions and return the complete improved answer.",
  );
  await page.screenshot({
    path: testInfo.outputPath("sanity-check-and-improve.png"),
  });
  await page.evaluate(() => localStorage.setItem("mock.fail", "true"));
  await dialog
    .getByRole("button", { name: "Check & improve", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Simulated model failure",
  );
  await expect(review).toHaveValue(
    "Check assumptions and return the complete improved answer.",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("mock.boards")!)[0],
    ),
  ).toEqual(beforeReview);
  await page.evaluate(() => localStorage.removeItem("mock.fail"));
  await dialog
    .getByRole("button", { name: "Check & improve", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("cancelled");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("mock.boards")!)[0],
    ),
  ).toEqual(beforeReview);
  await dialog
    .getByRole("button", { name: "Check & improve", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByLabel("Note version", { exact: true }).locator("option"),
  ).toHaveCount(3);
  const afterReview = await page.evaluate(
    () => JSON.parse(localStorage.getItem("mock.boards")!)[0],
  );
  const improved = afterReview.notes[0].versions[2];
  expect(improved.basedOnVersionId).toBe(beforeReview.notes[0].versions[1].id);
  expect(improved.prompt).toBe(beforeReview.notes[0].prompt);
  expect(improved.context.slice(-2)).toEqual([
    { role: "assistant", content: "A completed replacement." },
    {
      role: "user",
      content: "Check assumptions and return the complete improved answer.",
    },
  ]);
  expect(improved.context).toEqual(
    (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("mock.request")!),
      )
    ).messages,
  );
  expect(afterReview.notes[0].versions.slice(0, 2)).toEqual(
    beforeReview.notes[0].versions,
  );
  expect(afterReview.edges).toEqual(beforeReview.edges);
  expect(afterReview.artefacts).toEqual(beforeReview.artefacts);
  await page.reload();
  await page.locator(".note-card .note-prompt").first().click();
  await expect(page.getByLabel("Note version", { exact: true })).toHaveValue(
    improved.id,
  );
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").first().click();
  await expect(page.getByLabel("Note version", { exact: true })).toHaveValue(
    beforeReview.notes[0].versions[0].id,
  );
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(
    beforeReview.edges[0].highlight.text,
  );
});
