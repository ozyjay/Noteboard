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
        return [{ id: `model-${id}`, name: `Model ${id}` }];
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
  expect(await page.evaluate(() => localStorage.getItem("calls.a"))).toBe("1");
  await account.selectOption("b");
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
  await page
    .getByRole("button", { name: "Refresh models", exact: true })
    .click();
  await expect(
    page.getByText("Catalogue temporarily unavailable", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("calls.b")))
    .toBe("3");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(model.locator("option")).toHaveText(["Select a model"]);
  await page
    .getByRole("button", { name: "Continue with ChatGPT", exact: true })
    .click();
  await expect(model.locator("option")).toHaveText([
    "Select a model",
    "Model b",
  ]);
  expect(await page.evaluate(() => localStorage.getItem("calls.b"))).toBe("4");
});
