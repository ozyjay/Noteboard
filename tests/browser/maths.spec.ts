import { test, expect } from "@playwright/test";

test("maths survives equation branching, synthesis editing and reopening", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Appearance settings", exact: true })
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
  await page.getByRole("button", { name: "Back to Board" }).click();
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
