import { test, expect } from "@playwright/test";
import { chatGPTExportFixture as importFixture } from "../fixtures/chatgpt-export";

test("ChatGPT import previews paths, cancels and rejects unsupported input", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Import ChatGPT conversation", exact: true })
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
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Import ChatGPT conversation", exact: true })
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
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Import ChatGPT conversation", exact: true })
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
