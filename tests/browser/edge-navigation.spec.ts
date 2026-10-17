import { test, expect } from "@playwright/test";

test("edge labels wrap and reveal complete text with pointer and keyboard access", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".note-card")).toHaveCount(3);
  const passage =
    "A connection preserves the complete passage selected from its source, including details beyond the old character limit. "
      .repeat(30)
      .trim();
  await page.evaluate((text) => {
    const boards = JSON.parse(localStorage.getItem("inquiry.boards")!);
    const b = boards[0];
    b.notes = b.notes.slice(0, 2);
    b.edges = b.edges.slice(0, 1);
    const parent = b.notes[0];
    parent.versions[0].text = text;
    b.edges[0].highlight = {
      sourceId: parent.id,
      versionId: parent.versions[0].id,
      text,
      start: 0,
      end: text.length,
      surface: "markdown",
    };
    parent.position = { x: 80, y: 160 };
    b.notes[1].position = { x: 650, y: 160 };
    b.viewport = { x: 0, y: 0, zoom: 1 };
    localStorage.setItem("inquiry.boards", JSON.stringify(boards));
  }, passage);
  await page.reload();
  const label = page.locator(".edge-label");
  const preview = page.getByRole("region", { name: "Full connection text" });
  await expect(label).toHaveText(passage);
  const dimensions = await label.locator("span").evaluate((element) => ({
    height: element.clientHeight,
    lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    overflowing: element.scrollHeight > element.clientHeight,
  }));
  expect(dimensions.height).toBeCloseTo(dimensions.lineHeight * 2, 0);
  expect(dimensions.overflowing).toBe(true);
  await label.hover();
  await expect(preview.locator(".edge-preview-text")).toHaveText(passage);
  const bounds = await preview.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(8);
  expect(bounds!.y).toBeGreaterThanOrEqual(8);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440 - 8);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1000 - 8);
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("edge-preview.png") });
  await page.mouse.move(10, 10);
  await expect(preview).toHaveCount(0);
  await label.focus();
  await expect(preview).toBeVisible();
  await label.press("ArrowDown");
  await expect(preview).toBeFocused();
  await preview.press("End");
  await expect(
    preview.getByRole("button", { name: "Open source Note" }),
  ).toBeInViewport();
  await preview.press("Escape");
  await expect(label).toBeFocused();
  await expect(preview).toHaveCount(0);
  await label.press("Enter");
  await expect(page.locator(".reader-response")).toHaveText(passage);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(passage);
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  await page.reload();
  await label.click();
  await expect(page.locator(".reader-response")).toHaveText(passage);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(passage);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  const linePoint = await page
    .locator(".react-flow__edge-path")
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const point = path.getPointAtLength(25);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(
        path.getScreenCTM()!,
      );
      return { x: screen.x, y: screen.y };
    });
  await page.mouse.click(linePoint.x, linePoint.y);
  await expect(page.locator(".reader-response")).toHaveText(passage);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(passage);
  await page.getByRole("button", { name: "Close Note", exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Zoom out" }).click();
  await expect(label).toHaveClass(/edge-label-distant/);
  await label.focus();
  await expect(preview).toBeVisible();
  await expect(label).not.toHaveClass(/edge-label-distant/);
});
