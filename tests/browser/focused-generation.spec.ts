import { expect, test, type Page } from "@playwright/test";

async function controlledGeneration(page: Page) {
  await page.addInitScript(() => {
    const deltas = new Set<(event: { id: string; text: string }) => void>();
    const progress = new Set<
      (event: { id: string; activity: "thinking" | "searching" }) => void
    >();
    let pending:
      | {
          id: string;
          resolve: (value: { text: string; model: string }) => void;
          reject: (error: Error) => void;
        }
      | undefined;
    window.addEventListener("test:activity", (event) => {
      const activity = (event as CustomEvent).detail;
      progress.forEach((listener) => listener({ id: pending!.id, activity }));
    });
    window.addEventListener("test:delta", () => {
      deltas.forEach((listener) =>
        listener({ id: "stale-request", text: "Wrong answer" }),
      );
      deltas.forEach((listener) =>
        listener({
          id: pending!.id,
          text: "A partial answer about connected ideas.",
        }),
      );
    });
    window.addEventListener("test:finish", () =>
      pending!.resolve({
        text: "A complete answer about connected ideas.",
        model: "test-local",
      }),
    );
    window.addEventListener("test:fail", () =>
      pending!.reject(new Error("Test connection failed")),
    );
    window.inquiry = {
      listBoards: async () =>
        JSON.parse(localStorage.getItem("test.boards") || "[]").sort(
          (a: { updatedAt: string }, b: { updatedAt: string }) =>
            b.updatedAt.localeCompare(a.updatedAt),
        ),
      saveBoard: async (board) => {
        const boards = JSON.parse(localStorage.getItem("test.boards") || "[]");
        localStorage.setItem(
          "test.boards",
          JSON.stringify([
            board,
            ...boards.filter((b: { id: string }) => b.id !== board.id),
          ]),
        );
      },
      deleteBoard: async () => {},
      getSettings: async () =>
        ({
          provider: "ollama",
          endpoint: "http://127.0.0.1:11434",
          model: "test-local",
          contextLimit: 8192,
          depthReminder: 8,
        }) as Awaited<
          ReturnType<NonNullable<Window["inquiry"]>["getSettings"]>
        >,
      saveSettings: async () => {},
      models: async () => ["test-local", "alternative-local"],
      chatgptAccounts: async () => [],
      chatgptSignIn: async () => [],
      chatgptCancelSignIn: async () => {},
      chatgptSignOut: async () => ({ revoked: true }),
      chatgptUsage: async () => {},
      generate: (req) =>
        new Promise((resolve, reject) => {
          pending = { id: req.id, resolve, reject };
        }),
      cancel: async () => {
        pending!.reject(new Error("Generation cancelled"));
      },
      onDelta: (listener) => {
        deltas.add(listener);
        return () => {
          deltas.delete(listener);
        };
      },
      onProgress: (listener) => {
        progress.add(listener);
        return () => {
          progress.delete(listener);
        };
      },
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Explain connected ideas");
}

test("submission streams real activity and opens focused reading with branching and Board return", async ({
  page,
}, testInfo) => {
  await controlledGeneration(page);
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Generating Note" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Sending request…");
  for (const [activity, label] of [
    ["thinking", "Thinking…"],
    ["searching", "Searching the web…"],
  ]) {
    await page.evaluate(
      (value) =>
        window.dispatchEvent(
          new CustomEvent("test:activity", { detail: value }),
        ),
      activity,
    );
    await expect(page.getByRole("status")).toHaveText(label);
  }
  await page.evaluate(() => window.dispatchEvent(new Event("test:delta")));
  await expect(page.getByRole("status")).toHaveText("Writing response…");
  await expect(page.getByLabel("Response preview")).toHaveText(
    "A partial answer about connected ideas.",
  );
  await expect(page.locator(".note-card")).toHaveCount(0);
  await expect(page.getByLabel("Elapsed time")).not.toHaveText("0s");
  await page.screenshot({ path: testInfo.outputPath("generation.png") });
  await page.evaluate(() => window.dispatchEvent(new Event("test:finish")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Back to Board" }),
  ).toBeFocused();
  await expect(
    page.getByRole("complementary", { name: "Workspace sidebar" }),
  ).toBeHidden();
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.locator(".canvas")).toHaveAttribute("inert", "");
  await expect(page.locator(".reader-response")).toHaveText(
    "A complete answer about connected ideas.",
  );
  await expect(
    page.getByRole("combobox", { name: "Note version" }),
  ).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("focused-note.png") });
  await page.locator(".reader-response").evaluate((root) => {
    const node = root.querySelector("p")!.firstChild!;
    const range = document.createRange();
    const start = node.textContent!.indexOf("connected ideas");
    range.setStart(node, start);
    range.setEnd(node, start + "connected ideas".length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue("What is connected ideas?");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Back to Board" }).click();
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".canvas")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".note-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(1);
});

test("failure and Stop restore the question and model choices without saving partial Notes", async ({
  page,
}) => {
  await controlledGeneration(page);
  await page
    .getByRole("button", { name: "Discover models", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Note model" })
    .selectOption("alternative-local");
  for (const outcome of ["fail", "stop"]) {
    await page.getByRole("textbox", { name: "Your question" }).press("Enter");
    await page.evaluate(() => window.dispatchEvent(new Event("test:delta")));
    await expect(page.getByLabel("Response preview")).toBeVisible();
    if (outcome === "stop")
      await page.getByRole("button", { name: "Stop", exact: true }).click();
    else
      await page.evaluate(() => window.dispatchEvent(new Event("test:fail")));
    await expect(
      page.getByRole("textbox", { name: "Your question" }),
    ).toHaveValue("Explain connected ideas");
    await expect(
      page.getByRole("combobox", { name: "Note model" }),
    ).toHaveValue("alternative-local");
    await expect(page.locator(".note-card")).toHaveCount(0);
  }
});
