import { test, expect } from "@playwright/test";

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
