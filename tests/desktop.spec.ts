import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
    await page
      .getByRole("button", { name: "New inquiry", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Your question" })
      .fill("My persisted desktop question");
    await page.getByRole("button", { name: "Ask & explore" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("Saved locally", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Appearance settings", exact: true })
      .click();
    await page.getByLabel("Theme", { exact: true }).selectOption("dark");
    await page.getByLabel("Reading text size").selectOption("large");
    await page.getByLabel("Interface font").selectOption("monospace");
    await page.getByLabel("Reading font").selectOption("serif");
    await page
      .getByRole("button", { name: "Save appearance", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
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
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
