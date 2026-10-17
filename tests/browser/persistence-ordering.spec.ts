import { test, expect } from "@playwright/test";
import type { InquiryBridge } from "../../src/bridge";
import { defaults, newBoard } from "../../src/core/model";

test("queued saves finish before deletion and cannot recreate a deleted Board", async ({
  page,
}) => {
  const first = { ...newBoard(), title: "Delete after pending save" };
  const second = { ...newBoard(), title: "Keep this Board" };
  await page.addInitScript(
    ({ boards, settings }) => {
      const key = "test.queued-boards";
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(boards));
      const read = () => JSON.parse(localStorage.getItem(key)!);
      const control = {
        events: [] as string[],
        release: () => {},
      };
      const delayed = new Promise<void>((resolve) => {
        control.release = resolve;
      });
      let firstSave = true;
      Object.assign(window, { writeControl: control });
      window.inquiry = {
        listBoards: async () => read(),
        getSettings: async () => settings,
        saveSettings: async () => {},
        saveBoard: async (board) => {
          control.events.push(`start:${board.id}`);
          if (firstSave) {
            firstSave = false;
            await delayed;
          }
          const remaining = read().filter(
            (b: { id: string }) => b.id !== board.id,
          );
          localStorage.setItem(key, JSON.stringify([...remaining, board]));
          control.events.push(`saved:${board.id}`);
        },
        deleteBoard: async (id) => {
          localStorage.setItem(
            key,
            JSON.stringify(read().filter((b: { id: string }) => b.id !== id)),
          );
          control.events.push(`deleted:${id}`);
        },
        chatgptAccounts: async () => [],
        chatgptSignIn: async () => [],
        chatgptCancelSignIn: async () => {},
        chatgptSignOut: async () => ({ revoked: true }),
        chatgptUsage: async () => {},
        models: async () => [],
        generate: async () => {
          throw new Error("Inference is not part of this persistence test");
        },
        cancel: async () => {},
        onDelta: () => () => {},
      } satisfies InquiryBridge;
    },
    { boards: [first, second], settings: defaults },
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(first.title);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { writeControl: { events: string[] } })
            .writeControl.events.length,
      ),
    )
    .toBe(1);

  // Queue a newer snapshot while the initial write is still in flight.
  await page.getByRole("button", { name: "Rename Board", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Board name" })
    .fill("Queued newer title");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete Board" }).click();
  await page.getByRole("button", { name: "Delete Board permanently" }).click();
  await expect(page.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  await page.evaluate(() =>
    (
      window as unknown as { writeControl: { release: () => void } }
    ).writeControl.release(),
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    second.title,
  );
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const events = await page.evaluate(
    () =>
      (window as unknown as { writeControl: { events: string[] } }).writeControl
        .events,
  );
  const deleted = events.indexOf(`deleted:${first.id}`);
  expect(deleted).toBeGreaterThan(events.indexOf(`saved:${first.id}`));
  expect(events.slice(deleted + 1)).not.toContain(`saved:${first.id}`);
  expect(events.filter((event) => event === `saved:${first.id}`)).toHaveLength(
    1,
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("test.queued-boards")!).map(
        (b: { id: string }) => b.id,
      ),
    ),
  ).toEqual([second.id]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    second.title,
  );
  await expect(page.locator(".boards button")).toHaveCount(1);
  // Release the new page's initial save so teardown does not leave a pending write.
  await page.evaluate(() =>
    (
      window as unknown as { writeControl: { release: () => void } }
    ).writeControl.release(),
  );
});
