import { test, expect } from "@playwright/test";

test("Note reader resizes by dragging and keyboard and keeps its width after expanding", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const reader = page.locator(".reader");
  const handle = page.getByRole("separator", { name: "Resize Note reader" });
  const source = await page.locator(".reader-response").textContent();
  const original = (await reader.boundingBox())!;
  const workspace = (await page.locator(".exploration").boundingBox())!;
  expect(original.width).toBeCloseTo(
    Math.min(640, Math.max(420, workspace.width * 0.4)),
    0,
  );
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x - 180, grip.y + grip.height / 2, { steps: 8 });
  await page.mouse.up();
  const wider = (await reader.boundingBox())!.width;
  expect(wider).toBeGreaterThan(original.width + 170);
  await expect(reader).not.toHaveClass(/reader-resizing/);
  await expect(page.locator(".reader-response")).toHaveText(source!);
  await handle.focus();
  await handle.press("ArrowRight");
  expect((await reader.boundingBox())!.width).toBe(wider - 32);
  const resized = (await reader.boundingBox())!.width;
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  await expect
    .poll(async () => (await reader.boundingBox())!.width)
    .toBe(resized);
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await expect
    .poll(async () => (await reader.boundingBox())!.width)
    .toBe(resized);
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  await expect(handle).toHaveCount(0);
  await page
    .getByRole("button", { name: "Collapse Note", exact: true })
    .click();
  expect((await reader.boundingBox())!.width).toBe(resized);
  await page.screenshot({
    path: testInfo.outputPath("resized-note-reader.png"),
  });
  await handle.focus();
  await handle.press("Home");
  expect((await reader.boundingBox())!.width).toBe(320);
  await handle.press("End");
  expect(
    (await page.locator(".canvas").boundingBox())!.width,
  ).toBeGreaterThanOrEqual(239);
  await page.setViewportSize({ width: 900, height: 800 });
  await expect
    .poll(async () => {
      const panel = (await reader.boundingBox())!;
      const workspace = (await page.locator(".exploration").boundingBox())!;
      return panel.width < workspace.width && panel.x >= workspace.x;
    })
    .toBe(true);
  await expect(page.locator(".reader-response")).toHaveText(source!);
});

test("expanded Note fills the workspace and retains passage navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "How do complex systems work?", exact: true })
    .click();
  const sourceText = await page.locator(".reader-response").textContent();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  const reader = (await page.locator(".reader").boundingBox())!;
  const body = (await page.locator(".exploration").boundingBox())!;
  expect(reader.width).toBe(body.width);
  expect(reader.height).toBe(body.height);
  await expect(page.locator(".reader-response")).toHaveText(sourceText!);
  await page.screenshot({ path: testInfo.outputPath("expanded-note.png") });
  await page
    .getByRole("button", { name: "Collapse Note", exact: true })
    .click();
  expect((await page.locator(".reader").boundingBox())!.width).toBeLessThan(
    body.width,
  );
  await page.getByRole("button", { name: "Close Note" }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await page.locator(".edge-label").first().click();
  await page.getByRole("button", { name: "Expand Note", exact: true }).click();
  expect(await page.evaluate(() => getSelection()?.toString())).not.toBe("");
  await page.locator(".reader-response").evaluate((root) => {
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(
    page.getByRole("button", { name: "Explore this passage" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore this passage" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toHaveValue(/^What is /);
});
