import { test, expect } from "@playwright/test";

test("appearance previews, cancels, saves and follows system changes after reopening", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.getByLabel("Note style").selectOption("sticky");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "sticky",
  );
  await page.getByLabel("Accent colour").selectOption("blue");
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("serif");
  await expect(page.locator("html")).toHaveAttribute(
    "data-interface-font",
    "monospace",
  );
  expect(
    await page
      .locator(".brand")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Consolas");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "classic",
  );
  await expect(page.locator("html")).toHaveAttribute("data-accent", "sage");
  await expect(page.locator("html")).toHaveAttribute(
    "data-interface-font",
    "standard",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-font",
    "sans",
  );
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Appearance settings", exact: true })
    .click();
  await page.getByLabel("Theme", { exact: true }).selectOption("system");
  await page.getByLabel("Note style").selectOption("sticky");
  await page.getByLabel("Accent colour").selectOption("plum");
  await page.getByLabel("Reading text size").selectOption("larger");
  await page.getByLabel("Show canvas grid").uncheck();
  await page.getByLabel("Interface font").selectOption("monospace");
  await page.getByLabel("Reading font").selectOption("monospace");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "plum");
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "sticky",
  );
  expect(
    await page
      .locator(".note-card")
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").pointerEvents),
  ).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("sticky-light.png") });
  await expect(page.locator("html")).toHaveAttribute(
    "data-text-size",
    "larger",
  );
  await expect(page.locator(".react-flow__background")).toHaveCount(0);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("dark-appearance.png") });
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  expect(
    await page
      .locator(".reader-response")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThan(18);
  await page.screenshot({
    path: testInfo.outputPath("dark-expanded-note.png"),
  });
  expect(
    await page
      .locator(".reader-response")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Consolas");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("inquiry.settings")!),
  );
  expect(stored.provider).toBe("demo");
  expect(stored.appearance).toEqual({
    noteStyle: "sticky",
    theme: "system",
    accent: "plum",
    textSize: "larger",
    showGrid: false,
    interfaceFont: "monospace",
    readingFont: "monospace",
  });
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Appearance settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset defaults" }).click();
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".react-flow__background")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute(
    "data-note-style",
    "classic",
  );
});

for (const style of [
  "classic",
  "sticky",
  "blueprint",
  "index",
  "studio",
] as const) {
  test(`${style} style previews, saves and supports light/dark reading`, async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(page.locator(".note-card")).toHaveCount(3);
    const original = await page.evaluate(() => {
      const { notes, edges, artefacts } = JSON.parse(
        localStorage.getItem("inquiry.boards")!,
      )[0];
      return { notes, edges, artefacts };
    });
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Appearance settings", exact: true })
      .click();
    await page.getByLabel("Note style").selectOption(style);
    await expect(page.locator("html")).toHaveAttribute(
      "data-note-style",
      style,
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-note-style",
      "classic",
    );
    for (const theme of ["light", "dark"]) {
      await page.getByRole("button", { name: "More", exact: true }).click();
      await page
        .getByRole("menuitem", { name: "Appearance settings", exact: true })
        .click();
      await page.getByLabel("Note style").selectOption(style);
      await page.getByLabel("Theme", { exact: true }).selectOption(theme);
      await page.getByLabel("Show canvas grid").uncheck();
      await page
        .getByRole("button", { name: "Save appearance", exact: true })
        .click();
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute(
        "data-note-style",
        style,
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".react-flow__background")).toHaveCount(0);
      await page
        .getByRole("checkbox", { name: "Select Note 1 for synthesis" })
        .check();
      await expect(page.locator(".note-card.chosen")).toHaveCount(1);
      const firstCard = page.locator(".note-card").first();
      expect(
        await firstCard.evaluate((card) =>
          Boolean(
            card
              .querySelector(".note-prompt")!
              .compareDocumentPosition(card.querySelector(".note-takeaway")!) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        ),
      ).toBe(true);
      if (style !== "blueprint") {
        const prompt = (await firstCard.locator(".note-prompt").boundingBox())!;
        const takeaway = (await firstCard
          .locator(".note-takeaway")
          .boundingBox())!;
        expect(takeaway.y).toBeGreaterThanOrEqual(prompt.y + prompt.height);
      }
      if (style === "blueprint") {
        const peek = page.locator(".note-card").first().locator(".note-peek");
        const collapsedHeight = (await page
          .locator(".note-card")
          .first()
          .boundingBox())!.height;
        await expect(peek.locator(".note-takeaway")).toBeHidden();
        await peek.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(peek.locator(".note-takeaway")).toBeVisible();
        expect(
          (await page.locator(".note-card").first().boundingBox())!.height,
        ).toBeGreaterThan(collapsedHeight);
        await expect(page.locator(".reader")).toHaveCount(0);
        await page.keyboard.press("Enter");
        await expect(peek.locator(".note-takeaway")).toBeHidden();
      }
      if (style === "studio") {
        const footer = page
          .locator(".note-card")
          .first()
          .locator(".note-bottom");
        expect(
          (await footer.getByRole("button").boundingBox())!.width,
        ).toBeCloseTo((await footer.boundingBox())!.width, 0);
      }
      await page.screenshot({
        path: testInfo.outputPath(`${style}-${theme}.png`),
      });
      await page
        .getByRole("button", {
          name: "How do complex systems work?",
          exact: true,
        })
        .click();
      await expect(page.locator(".reader-response")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`${style}-${theme}-reader.png`),
      });
      if (style === "sticky" || style === "studio") {
        await expect(page.getByLabel("Note version")).toBeHidden();
        await page.locator(".reader-tools summary").click();
      }
      await expect(page.getByLabel("Note version")).toBeVisible();
      const navigation = page.getByRole("navigation", {
        name: "Connected notes",
      });
      await navigation
        .getByRole("button", { name: "What is emergence?", exact: true })
        .click();
      await expect(page.locator(".reader h2").first()).toHaveText(
        "What is emergence?",
      );
      await navigation
        .getByRole("button", {
          name: "How do complex systems work?",
          exact: true,
        })
        .click();
      await expect(page.locator(".anchor-info")).toContainText("emergence");
      await page
        .getByRole("button", { name: "Close Note", exact: true })
        .click();
    }
    expect(
      await page.evaluate(() => {
        const { notes, edges, artefacts } = JSON.parse(
          localStorage.getItem("inquiry.boards")!,
        )[0];
        return { notes, edges, artefacts };
      }),
    ).toEqual(original);
  });
}
