import { expect, test } from "@playwright/test";

test("tables keep words intact, scroll within the reader and preserve Highlight sources", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const source = `| Activity | Recommended use | Reference |
| --- | --- | --- |
| **Backlog refinement** | Draft acceptance criteria and identify ambiguities. | ${"LongReference".repeat(12)} |
| **Sprint planning** | Discuss refinement and suggest smaller slices of work. | Example |`;
  await page.evaluate((text) => {
    const board = JSON.parse(localStorage.getItem("inquiry.boards")!)[0];
    board.notes = board.notes.slice(0, 1);
    board.edges = [];
    board.artefacts = [];
    board.notes[0].prompt = "Table example";
    board.notes[0].versions[0].text = text;
    localStorage.setItem("inquiry.boards", JSON.stringify([board]));
    localStorage.setItem(
      "inquiry.settings",
      JSON.stringify({
        provider: "demo",
        endpoint: "http://127.0.0.1:11434",
        model: "synthetic-demo",
        contextLimit: 8192,
        depthReminder: 8,
        appearance: {
          textSize: "larger",
          readingFont: "monospace",
          theme: "dark",
        },
      }),
    );
  }, source);
  await page.reload();
  await page
    .getByRole("button", { name: "Table example", exact: true })
    .click();
  const table = page.locator(".reader-response table");
  await expect(table).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  const measure = () =>
    table.evaluate((element) => {
      const words: number[] = [];
      for (const cell of element.querySelectorAll("th, td")) {
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (const match of node.textContent!.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            words.push(range.getClientRects().length);
          }
        }
      }
      return {
        words,
        scrollable: element.scrollWidth > element.clientWidth,
        overflow: getComputedStyle(element).overflowX,
      };
    });
  for (const expanded of [false, true]) {
    if (expanded)
      await page
        .getByRole("button", { name: "Expand Note", exact: true })
        .click();
    const layout = await measure();
    expect(layout.words.every((lines) => lines === 1)).toBe(true);
    expect(layout.scrollable).toBe(true);
    expect(layout.overflow).toBe("auto");
    expect(
      await page
        .locator(".reader-response")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
  }
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("intact-table-words.png"),
  });
  await table.evaluate((element) => {
    const node = element.querySelector(
      "tbody tr:nth-child(2) td:nth-child(2)",
    )!.firstChild!;
    const start = node.textContent!.indexOf("refinement");
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + "refinement".length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    element
      .closest(".reader-response")!
      .dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await page.getByRole("button", { name: "Back to Board" }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").click();
  await expect(page.locator(".anchor-info")).toHaveText(
    "Source Highlight: “refinement”",
  );
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(
    "refinement",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
          .versions[0].text,
    ),
  ).toBe(source);
});
