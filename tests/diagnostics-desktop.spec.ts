import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaults } from "../src/core/model";

test("desktop logs safe operation outcomes and exposes only its fixed logs folder", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "noteboard-desktop-logs-"));
  const env: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    INQUIRY_DEV: "0",
    INQUIRY_DATA_DIR: dir,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ args: [".", `--user-data-dir=${dir}`], env });
    const page = await app.firstWindow();
    await expect(page.locator(".note-card")).toHaveCount(3);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: "Open diagnostic logs" }),
    ).toBeVisible();
    const icon = page
      .getByRole("menuitem", { name: "Import a Board", exact: true })
      .locator("svg");
    await expect(icon).toHaveClass(/lucide-log-in/);
    await expect(
      page
        .getByRole("menuitem", { name: "Export Board", exact: true })
        .locator("svg"),
    ).toHaveClass(/lucide-log-out/);
    // Stub the native folder-opening effect, retaining the real IPC validation.
    await app.evaluate(({ shell }) => {
      shell.openPath = async (filename) => {
        (globalThis as unknown as { openedLogs: string }).openedLogs = filename;
        return "";
      };
    });
    await page.getByRole("menuitem", { name: "Open diagnostic logs" }).click();
    expect(
      await app.evaluate(
        () => (globalThis as unknown as { openedLogs: string }).openedLogs,
      ),
    ).toBe(path.join(dir, "logs"));
    await page.evaluate(async (settings) => {
      try {
        await window.inquiry!.saveSettings({
          ...settings,
          contextLimit: -1,
          customInstructions: "PRIVATE CUSTOM TEXT",
        });
      } catch {
        /* Expected validation failure. */
      }
      await window.inquiry!.generate({
        id: crypto.randomUUID(),
        purpose: "explore",
        settings,
        messages: [{ role: "user", content: "PRIVATE PROMPT" }],
      });
    }, defaults);
    await app.close();
    app = undefined;
    const raw = readFileSync(
      path.join(dir, "logs", "diagnostics.jsonl"),
      "utf8",
    );
    expect(raw).not.toContain("PRIVATE");
    const entries = raw
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "app.started" }),
        expect.objectContaining({
          event: "ipc.failed",
          operation: "settings:save",
          error: { category: "validation" },
        }),
        expect.objectContaining({
          event: "generation.completed",
          provider: "demo",
        }),
        expect.objectContaining({ event: "app.stopping" }),
      ]),
    );
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
