import { test, expect } from "@playwright/test";

test("Tab visits each Note once and Enter opens the Note", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Note mode", exact: true })
    .selectOption("read");
  const cards = page.locator(".note-card");
  await expect(cards).toHaveCount(3);
  await cards.first().focus();
  await page.keyboard.press("Tab");
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cards.nth(2)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".reader h2").first()).toHaveText(
    "What is emergence?",
  );
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  await cards.first().getByLabel("Layout Note 1", { exact: true }).click();
  await expect(
    cards.first().getByRole("button", { name: "Move Note", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(cards.nth(1)).toBeFocused();
  await expect(cards.first().locator(".note-layout")).not.toHaveAttribute(
    "open",
    "",
  );
  await page
    .getByRole("combobox", { name: "Note mode", exact: true })
    .selectOption("arrange");
  await cards.first().focus();
  await page.keyboard.press("Tab");
  await expect(cards.nth(1)).toBeFocused();
});
