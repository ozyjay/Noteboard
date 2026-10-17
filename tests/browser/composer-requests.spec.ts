import { test, expect } from "@playwright/test";

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
          {
            id: "test-chatgpt-model",
            name: "Test ChatGPT Model",
            defaultReasoningEffort: "high",
            reasoningEfforts: [{ effort: "high" }, { effort: "low" }],
          },
          {
            id: "test-other-model",
            name: "Another ChatGPT Model",
            defaultReasoningEffort: "medium",
            reasoningEfforts: [{ effort: "medium" }, { effort: "low" }],
          },
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
  await expect(
    page.getByLabel("Thinking effort", { exact: true }).locator("option"),
  ).toHaveText(["Model default (High)", "High", "Low"]);
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
    page.getByLabel("Note thinking effort").locator("option"),
  ).toHaveText(["Model default (Medium)", "Medium", "Low"]);
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
  await page.getByRole("button", { name: "Back to Board" }).click();
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
  await expect(page.getByLabel("Revision thinking effort")).toHaveValue("high");
  await page.getByLabel("Revision thinking effort").selectOption("low");
  await page.getByLabel("Revision model").selectOption("test-other-model");
  await expect(
    page.getByLabel("Revision thinking effort").locator("option"),
  ).toHaveText(["Model default (Medium)", "Medium", "Low"]);
  await expect(page.getByLabel("Revision thinking effort")).toHaveValue("");
  await page.getByLabel("Revision thinking effort").selectOption("medium");
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
    name: "Stop",
    exact: true,
  });
  await expect(cancelGeneration).toBeFocused();
  await expect(page.getByLabel("Note model", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("Note thinking effort", { exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(cancelGeneration).toBeFocused();
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
