import { test, expect } from "@playwright/test";

test("manual placement survives reopening the Board", async ({ page }) => {
  await page.goto("/");
  const label = page.locator(".note-number").first();
  await label.click();
  const box = (await label.boundingBox())!;
  const initial = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0].position,
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 90,
    box.y + box.height / 2 + 60,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
            .position.x,
      ),
    )
    .toBeGreaterThan(initial.x + 20);
  const placed = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0].position,
  );
  await page.reload();
  await expect(page.locator(".note-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("inquiry.boards")!)[0].notes[0]
          .position,
    ),
  ).toEqual(placed);
});
