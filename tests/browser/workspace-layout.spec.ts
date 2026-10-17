import { test, expect } from "@playwright/test";

for (const width of [900, 1150, 1512]) {
  test(`compact workspace fits long titles at ${width}px and retains its canvas`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".note-card")).toHaveCount(3);
    const title =
      "A long inquiry title about complex systems and the many connections between their individual components, with further questions about emergence, feedback and adaptation across different scales";
    await page.evaluate((title) => {
      const boards = JSON.parse(localStorage.getItem("inquiry.boards")!);
      boards[0].title = title;
      localStorage.setItem("inquiry.boards", JSON.stringify(boards));
    }, title);
    await page.reload();
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText(title);
    await expect(heading).toHaveAttribute("title", title);
    await expect(page.locator(".boards button").first()).toHaveAttribute(
      "title",
      title,
    );
    expect((await page.locator(".topbar").boundingBox())!.height).toBe(56);
    expect((await page.locator(".modebar").boundingBox())!.height).toBe(40);
    expect((await page.locator(".sidebar").boundingBox())!.width).toBe(
      width <= 1150 ? 200 : 220,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(
      await heading.evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBe(true);
    const sidebarTitle = page.locator(".board-list-title").first();
    expect(
      await sidebarTitle.evaluate(
        (el) =>
          el.clientHeight <=
          parseFloat(getComputedStyle(el).lineHeight) * 2 + 1,
      ),
    ).toBe(true);
    await page
      .getByRole("button", {
        name: "How do complex systems work?",
        exact: true,
      })
      .click();
    const response = await page.locator(".reader-response").textContent();
    const canvas = await page.locator(".react-flow").elementHandle();
    const viewport = await page
      .locator(".react-flow__viewport")
      .getAttribute("style");
    await page.getByRole("button", { name: "Hide sidebar" }).click();
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(page.locator(".reader-response")).toHaveText(response!);
    expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
    await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
      "style",
      viewport!,
    );
    await page.getByRole("button", { name: "Show sidebar" }).click();
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
      "style",
      viewport!,
    );
    const body = (await page.locator(".exploration").boundingBox())!;
    await expect
      .poll(async () => (await page.locator(".reader").boundingBox())!.width)
      .toBeCloseTo(Math.min(640, Math.max(420, body.width * 0.4)), 0);
    expect(
      (await page.locator(".canvas").boundingBox())!.width,
    ).toBeGreaterThanOrEqual(239);
    await page.screenshot({
      path: testInfo.outputPath(`compact-${width}.png`),
    });
  });
}

test("More menu supports keyboard navigation, dismissal and dialog focus restoration", async ({
  page,
}) => {
  await page.goto("/");
  const more = page.getByRole("button", { name: "More", exact: true });
  const menu = page.getByRole("menu", { name: "Workspace actions" });
  await more.focus();
  await more.press("ArrowDown");
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  const appearance = menu.getByRole("menuitem", {
    name: "Appearance settings",
  });
  await expect(appearance).toBeFocused();
  await appearance.press("End");
  await expect(
    menu.getByRole("menuitem", { name: "Delete Board" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(appearance).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Home");
  await expect(appearance).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.press("ArrowUp");
  await expect(
    menu.getByRole("menuitem", { name: "Delete Board" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await more.click();
  await appearance.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await more.click();
  await menu.getByRole("menuitem", { name: "Delete Board" }).click();
  await expect(
    page.getByRole("dialog", { name: "Delete Board" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(more).toBeFocused();
  await more.click();
  await page.locator(".modebar").click();
  await expect(menu).toHaveCount(0);
  await more.click();
  await page.keyboard.press("Tab");
  await expect(menu).toHaveCount(0);
  await expect(more).not.toBeFocused();
  await more.click();
  const download = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: "Export Board" }).click();
  expect((await download).suggestedFilename()).toBe("noteboard-board.json");
  await expect(more).toBeFocused();
  await more.click();
  const chooser = page.waitForEvent("filechooser");
  await menu
    .getByRole("menuitem", { name: "Import a Board", exact: true })
    .click();
  await chooser;
  await expect(menu).toHaveCount(0);
});
