import { test, expect } from "@playwright/test";

test("Note prompts send on Enter while preserving multiline and composed input", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New inquiry", exact: true }).click();
  const prompt = page.getByRole("textbox", { name: "Your question" });
  await prompt.fill("   ");
  await prompt.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".note-card")).toHaveCount(0);
  await prompt.fill("First line");
  await prompt.press("End");
  await prompt.press("Shift+Enter");
  await prompt.pressSequentially("Second line");
  await expect(prompt).toHaveValue("First line\nSecond line");
  await prompt.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        repeat: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.locator(".note-card")).toHaveCount(0);
  await prompt.press("Enter");
  await expect(prompt).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText(
    "Preparing synthetic demo…",
  );
  await expect(page.locator(".stream-preview")).toHaveCount(0);
  await expect(page.locator(".note-card")).toHaveCount(1);
  await expect(page.locator(".reader h2").first()).toHaveText(
    "First line\nSecond line",
  );
  await expect(page.locator(".reader-response")).toContainText(
    "Where this fits",
  );
  await expect(page.locator(".reader-response")).toContainText("Takeaway:");
  await expect(page.locator(".note-takeaway")).not.toContainText(
    "Where this fits",
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "First line Second line", exact: true })
    .click();
  await expect(page.locator(".reader-response")).toContainText(
    "Where this fits",
  );
});
