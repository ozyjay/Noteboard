import { test, expect } from "@playwright/test";

test("ChatGPT catalogues isolate accounts, ignore late results and recover through refresh and sign-in", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let connected = true;
    window.inquiry = {
      chatgptUsage: async () => {},
      saveBoard: async () => {},
      deleteBoard: async () => {},
      saveSettings: async () => {},
      generate: async () => {
        throw new Error("Inference is outside this test");
      },
      cancel: async () => {},
      onDelta: () => () => {},
      listBoards: async () => [],
      getSettings: async () => ({
        provider: "demo",
        endpoint: "http://127.0.0.1:11434",
        model: "",
        contextLimit: 8192,
        depthReminder: 8,
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
      }),
      chatgptAccounts: async () =>
        ["a", "b"].map((id) => ({
          id,
          label: `Account ${id}`,
          connected,
          planEnabled: connected,
        })),
      chatgptCancelSignIn: async () => {},
      chatgptSignOut: async () => {
        connected = false;
        return { revoked: true };
      },
      chatgptSignIn: async () => {
        connected = true;
        return ["a", "b"].map((id) => ({
          id,
          label: `Account ${id}`,
          connected,
          planEnabled: true,
        }));
      },
      models: async (settings) => {
        const id = settings.chatgptAccountId!;
        localStorage.setItem(
          `calls.${id}`,
          String(Number(localStorage.getItem(`calls.${id}`) || 0) + 1),
        );
        if (id === "a")
          await new Promise<void>((resolve) =>
            window.addEventListener("finish-a", () => resolve(), {
              once: true,
            }),
          );
        if (localStorage.getItem("fail-models"))
          throw new Error("Catalogue temporarily unavailable");
        return [
          {
            id: `model-${id}`,
            name: `Model ${id}`,
            ...(id === "b"
              ? {
                  defaultReasoningEffort: "high",
                  reasoningEfforts: localStorage.getItem("changed-levels")
                    ? [{ effort: "high" }]
                    : [
                        { effort: "high", description: "Deeper reasoning" },
                        { effort: "low" },
                        { effort: "ultra" },
                        { effort: "future-level" },
                      ],
                }
              : {}),
          },
        ];
      },
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Provider settings", exact: true })
    .click();
  await page.getByLabel("Provider", { exact: true }).selectOption("chatgpt");
  const account = page.getByLabel("ChatGPT account", { exact: true });
  const model = page.getByLabel("Model", { exact: true });
  await account.selectOption("a");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("calls.a")))
    .toBe("1");
  await account.selectOption("b");
  await expect(model.locator("option")).toHaveText([
    "Select a model",
    "Model b",
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event("finish-a")));
  await expect(model.locator("option")).toHaveText([
    "Select a model",
    "Model b",
  ]);
  await account.selectOption("a");
  await expect(model.locator("option")).toHaveText([
    "Select a model",
    "Model a",
  ]);
  await model.selectOption("model-a");
  await expect(
    page.getByLabel("Thinking effort", { exact: true }).locator("option"),
  ).toHaveText(["Model default"]);
  await expect(
    page.getByText(
      "Thinking levels were not provided for this model. Refresh models to check again.",
    ),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("calls.a"))).toBe("1");
  await account.selectOption("b");
  await model.selectOption("model-b");
  const thinking = page.getByLabel("Thinking effort", { exact: true });
  await expect(thinking.locator("option")).toHaveText([
    "Model default (High)",
    "High",
    "Low",
    "Ultra",
    "future-level",
  ]);
  await expect(
    thinking.locator('option[value="future-level"]'),
  ).toHaveJSProperty("disabled", true);
  await thinking.selectOption("low");
  await page.evaluate(() => localStorage.setItem("fail-models", "yes"));
  await page
    .getByRole("button", { name: "Refresh models", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(model.locator("option")).toHaveText([
    "Select a model",
    "Model b",
  ]);
  await page.evaluate(() => localStorage.removeItem("fail-models"));
  await page.evaluate(() => localStorage.setItem("changed-levels", "yes"));
  await page
    .getByRole("button", { name: "Refresh models", exact: true })
    .click();
  await expect(
    page.getByText("Catalogue temporarily unavailable", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("calls.b")))
    .toBe("3");
  await expect(thinking).toHaveValue("low");
  await expect(thinking.locator("option")).toHaveText([
    "Model default (High)",
    "Low (support unconfirmed)",
    "High",
  ]);
  await thinking.selectOption("high");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(model.locator("option")).toHaveText([
    "Select a model",
    "model-b",
  ]);
  await expect(thinking.locator("option")).toHaveText([
    "Model default",
    "High (support unconfirmed)",
  ]);
  await page
    .getByRole("button", { name: "Continue with ChatGPT", exact: true })
    .click();
  await expect(model.locator("option")).toHaveText([
    "Select a model",
    "Model b",
  ]);
  expect(await page.evaluate(() => localStorage.getItem("calls.b"))).toBe("4");
});
