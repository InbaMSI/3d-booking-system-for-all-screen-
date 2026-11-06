import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error("Browser page error:", error));
});

test("movie discovery to seat hold and verified pending status", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.getByRole("link", { name: /view showtimes for the last orbit/i }).click();
  await expect(page).toHaveURL(/\/movies\/the-last-orbit$/);
  await page.getByRole("link", { name: /6:30|6:30 pm/i }).first().click();
  await expect(page).toHaveURL(/\/shows\/show-the-last-orbit-marina-crown-1830\/seats$/);
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "2D seat map" })).toHaveCount(0);
  await page.locator(".canvas-wrap").scrollIntoViewIfNeeded();
  const canvasBox = await page.locator(".canvas-wrap").boundingBox();
  if (!canvasBox) throw new Error("The 3D auditorium canvas has no layout box.");
  await page.mouse.move(canvasBox.x + 12, canvasBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 40, canvasBox.y + 18);
  await page.mouse.up();
  await expect(page.getByText("0 selected")).toBeVisible();
  await page.waitForTimeout(800);
  const seatPicker = page.locator("#accessible-seat-picker");
  const availableSeatIds = await seatPicker.locator("option:not([disabled])").evaluateAll(
    (options) => options.map((option) => (option as HTMLOptionElement).value),
  );
  const firstSeatId = availableSeatIds[0];
  if (!firstSeatId) throw new Error("The show has no available seats.");
  await seatPicker.selectOption(firstSeatId);
  const firstSeatLabel = await page.locator(".selected-seat-list li strong").first().innerText();
  const [, firstRow, firstNumber] = firstSeatLabel.match(/^([A-Z]+)(\d+)$/) ?? [];
  if (!firstRow || !firstNumber) throw new Error(`Unexpected selected seat label: ${firstSeatLabel}`);
  await expect(page.getByRole("button", { name: `Preview seat ${firstSeatLabel}` })).toBeVisible();
  await expect(page.getByText(`Your view from Row ${firstRow}, seat ${Number(firstNumber)}`)).toBeVisible();
  await expect(page.getByText(/SEATED 360° VIEW · FACING THE SCREEN/i)).toBeVisible();
  await page.locator(".canvas-wrap").scrollIntoViewIfNeeded();
  const seatedBox = await page.locator(".canvas-wrap").boundingBox();
  if (!seatedBox) throw new Error("The seated-view canvas is not visible.");
  await page.mouse.move(seatedBox.x + seatedBox.width / 2, seatedBox.y + seatedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(seatedBox.x + seatedBox.width / 2 + 120, seatedBox.y + seatedBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText(/SEATED 360° VIEW · LOOKING RIGHT/i)).toBeVisible();
  await expect(page.getByText("1 selected")).toBeVisible();
  await page.getByRole("button", { name: "Return to auditorium overview" }).click();
  await page.waitForTimeout(900);
  await page.locator(".canvas-wrap").scrollIntoViewIfNeeded();
  const overviewBox = await page.locator(".canvas-wrap").boundingBox();
  if (!overviewBox) throw new Error("The auditorium canvas is not visible after returning to overview.");
  const secondSeatId = availableSeatIds.find((seatId) => seatId !== firstSeatId);
  if (!secondSeatId) throw new Error("The show has fewer than two available seats.");
  await seatPicker.selectOption(secondSeatId);
  const [, secondRow, secondNumber] = secondSeatId.match(/^seat-([A-Z]+)-0*(\d+)$/) ?? [];
  if (!secondRow || !secondNumber) throw new Error(`Unexpected seat ID: ${secondSeatId}`);
  const secondSeatLabel = `${secondRow}${Number(secondNumber)}`;
  await expect(page.getByText("2 selected")).toBeVisible();
  await expect(page.getByRole("button", { name: `Preview seat ${secondSeatLabel}` })).toBeVisible();
  await page.getByRole("button", { name: `Preview seat ${firstSeatLabel}` }).click();
  await expect(page.getByText(`Your view from Row ${firstRow}, seat ${Number(firstNumber)}`)).toBeVisible();
  await page.getByRole("button", { name: "Return to auditorium overview" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]+$/i);
  await expect(page.locator(".demo-banner")).toContainText(/DEMO · (MOCK API|LOCAL SQLITE BACKEND)/);
  await page.getByRole("button", { name: /create demo payment order/i }).click();
  await expect(page.getByText("Awaiting verification")).toBeVisible();
  await page.getByRole("link", { name: "View booking status" }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+$/i);
  await expect(page.getByText("Payment has not been verified. This is not a confirmed ticket.")).toBeVisible();
});

test("mobile keeps 3D seat browsing with an accessible booking fallback", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const showsResponse = await request.get("/api/v1/cinemas/marina-crown/shows");
  const shows = (await showsResponse.json()).items as Array<{ id: string }>;
  await page.goto(`/shows/${shows[0].id}/seats`);
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("#accessible-seat-picker").selectOption("seat-C-02");
  await expect(page.getByText("1 selected")).toBeVisible();
});
