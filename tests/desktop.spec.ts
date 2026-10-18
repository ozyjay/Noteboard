import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chatGPTExportFixture } from "./fixtures/chatgpt-export";
import { Store } from "../electron/store";
import { defaults } from "../src/core/model";

test("macOS unprovisioned desktop reports the signing requirement without changing credentials", async () => {
  test.skip(process.platform !== "darwin", "macOS Keychain integration");
  const dir = mkdtempSync(path.join(tmpdir(), "noteboard-touchid-desktop-"));
  const filename = path.join(dir, "chatgpt-credentials.bin");
  const synthetic = Buffer.concat([Buffer.from("NBKC\x01"), Buffer.alloc(48)]);
  writeFileSync(filename, synthetic, { mode: 0o600 });
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.INQUIRY_DEV = "0";
  env.INQUIRY_DATA_DIR = dir;
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ args: [".", `--user-data-dir=${dir}`], env });
    const page = await app.firstWindow();
    const message = await page.evaluate(async () => {
      try {
        await window.inquiry!.chatgptAccounts();
        return "unexpected success";
      } catch (error) {
        return String(error);
      }
    });
    expect(message).toContain("matching provisioning profile");
    expect(readFileSync(filename)).toEqual(synthetic);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("desktop model catalogue and thinking metadata reopen through the isolated bridge without discovery", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-desktop-catalogue-"));
  const catalogue = {
    discoveredAt: "2026-10-16T00:00:00.000Z",
    models: [
      {
        id: "fixture-model",
        name: "Fixture model",
        reasoningEfforts: [
          { effort: "low", description: "Faster" },
          { effort: "high" },
        ],
        defaultReasoningEffort: "low",
      },
    ],
  };
  const store = new Store(path.join(dir, "inquiry.sqlite"));
  store.saveModelCatalogue("fixture-account", catalogue);
  store.close();
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.INQUIRY_DEV = "0";
  env.INQUIRY_DATA_DIR = dir;
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    for (let launch = 0; launch < 2; launch++) {
      app = await electron.launch({
        args: [".", `--user-data-dir=${dir}`],
        env,
      });
      const page = await app.firstWindow();
      await expect(page.locator(".note-card")).toHaveCount(3);
      const models = await page.evaluate(
        async (settings) => window.inquiry!.models(settings),
        {
          ...defaults,
          provider: "chatgpt" as const,
          chatgptAccountId: "fixture-account",
        },
      );
      expect(models).toEqual(catalogue.models);
      const rejected = await page.evaluate(
        async (settings) => {
          try {
            await window.inquiry!.models(settings, "invalid" as never);
            return false;
          } catch {
            return true;
          }
        },
        {
          ...defaults,
          provider: "chatgpt" as const,
          chatgptAccountId: "fixture-account",
        },
      );
      expect(rejected).toBe(true);
      await app.close();
      app = undefined;
    }
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("desktop reopens a renamed Board and graph layout from SQLite", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-desktop-rename-"));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.INQUIRY_DEV = "0";
  env.INQUIRY_DATA_DIR = dir;
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ args: [".", `--user-data-dir=${dir}`], env });
    let page = await app.firstWindow();
    await expect(page.locator(".note-card")).toHaveCount(3);
    const original = await page.evaluate(
      async () => (await window.inquiry!.listBoards())[0],
    );
    await page.locator(".boards button").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Board name" })
      .fill("My renamed exploration");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await window.inquiry!.listBoards())[0].title,
        ),
      )
      .toBe("My renamed exploration");
    await page.getByLabel("Layout Note 1", { exact: true }).click();
    await page
      .locator(".note-card")
      .first()
      .getByRole("radio", { name: "Below", exact: true })
      .check();
    await page.getByLabel("Layout Note 1", { exact: true }).click();
    await page
      .getByRole("button", { name: "Move with descendants", exact: true })
      .click();
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Enter");
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await window.inquiry!.listBoards())[0].notes[0].position.y,
        ),
      )
      .toBe(original.notes[0].position.y + 50);
    await app.close();
    app = await electron.launch({ args: [".", `--user-data-dir=${dir}`], env });
    page = await app.firstWindow();
    await expect(page.locator("h1")).toHaveText("My renamed exploration");
    const saved = await page.evaluate(
      async () => (await window.inquiry!.listBoards())[0],
    );
    expect(saved.id).toBe(original.id);
    expect(saved.notes).toEqual(
      original.notes.map((n, index) => ({
        ...n,
        position: { ...n.position, y: n.position.y + 50 },
        ...(index === 0 ? { childDirection: "below" } : {}),
      })),
    );
    await expect(
      page.getByRole("button", { name: "Undo layout", exact: true }),
    ).toBeDisabled();
    expect(saved.edges).toEqual(original.edges);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("desktop imports a chain, keeps retrospective anchors and reopens spatial Notes", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-desktop-import-"));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.INQUIRY_DEV = "0";
  env.INQUIRY_DATA_DIR = dir;
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ args: ["."], env });
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("menuitem", {
        name: "Import ChatGPT conversation",
        exact: true,
      })
      .click();
    await page.getByLabel("ChatGPT export file").setInputFiles({
      name: "conversations.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(chatGPTExportFixture)),
    });
    await page.getByLabel("Conversation", { exact: true }).selectOption("0");
    await page
      .getByRole("button", { name: "Import conversation", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Explain café systems", exact: true })
      .click();
    await page.locator(".reader-response").evaluate((root) => {
      const range = document.createRange();
      range.selectNodeContents(root.querySelector("strong")!);
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
    await expect(page.locator(".existing-branches")).toContainText(
      "Retrospective Highlight",
    );
    const before = await page.evaluate(async () =>
      (await window.inquiry!.listBoards()).find(
        (b) => b.title === "Imported café conversation",
      ),
    );
    const card = page.locator(".note-card").first();
    const box = (await card.locator(".note-drag-handle").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 65, box.y + 70, {
      steps: 10,
    });
    await page.mouse.up();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await window.inquiry!.listBoards()).find(
              (b) => b.title === "Imported café conversation",
            )!.notes[0].position,
        ),
      )
      .not.toEqual(before!.notes[0].position);
    const saved = await page.evaluate(async () =>
      (await window.inquiry!.listBoards()).find(
        (b) => b.title === "Imported café conversation",
      ),
    );
    await app.close();
    app = await electron.launch({ args: ["."], env });
    page = await app.firstWindow();
    await expect(page.locator(".note-card")).toHaveCount(2);
    const reopened = await page.evaluate(async () =>
      (await window.inquiry!.listBoards()).find(
        (b) => b.title === "Imported café conversation",
      ),
    );
    expect({ ...reopened, updatedAt: saved!.updatedAt }).toEqual(saved);
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await page.locator(".edge-label").click();
    expect(await page.evaluate(() => getSelection()?.toString())).toBe("term");
    await expect(page.locator(".reader-scroll")).toContainText(
      "Imported from ChatGPT",
    );
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("production desktop bridge saves and reopens an inquiry in SQLite", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "inquiry-desktop-"));
  let app;
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.INQUIRY_DEV = "0";
  env.INQUIRY_DATA_DIR = dir;
  delete env.ELECTRON_RUN_AS_NODE;
  try {
    app = await electron.launch({
      args: [".", `--user-data-dir=${dir}`],
      env,
    });
    let page = await app.firstWindow();
    expect(await app.evaluate(({ app }) => app.getName())).toBe("Noteboard");
    await expect(page).toHaveTitle("Noteboard — Follow your curiosity");
    await expect(page.locator(".note-card")).toHaveCount(3);
    expect(await page.evaluate(() => typeof window.inquiry?.saveBoard)).toBe(
      "function",
    );
    await expect(page.locator(".preview-banner")).toHaveCount(0);
    expect(
      await page.evaluate(async () => {
        try {
          await window.inquiry!.openWebLink!("javascript:alert(1)");
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    await page
      .getByRole("button", { name: "New inquiry", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Your question" })
      .fill("My persisted desktop question");
    await page.getByRole("button", { name: "Ask & explore" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Back to Board" }).click();
    await expect(
      page.getByText("Saved locally", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Appearance settings", exact: true })
      .click();
    await page.getByLabel("Theme", { exact: true }).selectOption("dark");
    await page.getByLabel("Reading text size").selectOption("large");
    await page.getByLabel("Interface font").selectOption("monospace");
    await page.getByLabel("Reading font").selectOption("serif");
    await page
      .getByRole("button", { name: "Save appearance", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edit prompt and regenerate", exact: true })
      .click();
    await page
      .getByLabel("Revised prompt")
      .fill("Revised persisted desktop question");
    await page
      .getByRole("button", { name: "Generate new version", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edit response", exact: true })
      .click();
    await page
      .getByLabel("Revised response")
      .fill("My reviewed desktop answer with $x^2$.");
    await page
      .getByRole("button", { name: "Save edited version", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await window.inquiry!.listBoards()).find(
              (b) => b.title === "My persisted desktop question",
            )!.notes[0].versions.length,
        ),
      )
      .toBe(3);
    await app.close();
    app = await electron.launch({
      args: [".", `--user-data-dir=${dir}`],
      env,
    });
    page = await app.firstWindow();
    await expect(
      page
        .getByRole("heading", {
          name: "My persisted desktop question",
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(page.locator(".note-card")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute(
      "data-text-size",
      "large",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-interface-font",
      "monospace",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-reading-font",
      "serif",
    );
    expect(
      await page.evaluate(
        () => typeof (window as unknown as { require?: unknown }).require,
      ),
    ).toBe("undefined");
    await page.locator(".note-card .note-prompt").click();
    await expect(
      page.getByLabel("Note version", { exact: true }).locator("option"),
    ).toHaveCount(3);
    await expect(page.locator(".reader h2").first()).toHaveText(
      "Revised persisted desktop question",
    );
    await expect(page.locator(".note-meta")).toContainText("HUMAN-EDITED");
    await expect(page.locator(".reader-response .katex")).toHaveCount(1);
    const versions = await page
      .getByLabel("Note version", { exact: true })
      .locator("option")
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value),
      );
    await page
      .getByLabel("Note version", { exact: true })
      .selectOption(versions[0]);
    await expect(page.locator(".reader h2").first()).toHaveText(
      "My persisted desktop question",
    );
    await page
      .getByLabel("Note version", { exact: true })
      .selectOption(versions[2]);
    await page.locator(".note-card .note-prompt").click();
    await page
      .getByRole("button", { name: "Delete Note", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete Note and descendants", exact: true })
      .click();
    await expect(page.locator(".note-card")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await window.inquiry!.listBoards()).find(
              (b) => b.title === "My persisted desktop question",
            )!.notes.length,
        ),
      )
      .toBe(0);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Delete Board", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete Board permanently", exact: true })
      .click();
    await expect(page.locator(".note-card")).toHaveCount(3);
    await app.close();
    app = await electron.launch({ args: [".", `--user-data-dir=${dir}`], env });
    page = await app.firstWindow();
    await expect(page.locator(".note-card")).toHaveCount(3);
    expect(
      await page.evaluate(async () =>
        (await window.inquiry!.listBoards()).some(
          (b) => b.title === "My persisted desktop question",
        ),
      ),
    ).toBe(false);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
