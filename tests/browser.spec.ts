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
  await page.locator(".react-flow__edge").click();
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
