import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const api = "/api/v1";
const authorization = { Authorization: "Bearer local-chennai-demo-token" };

test("the cinema browser lists all five venues and opens their screening schedules", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Cinemas", exact: true }).click();
  await expect(page).toHaveURL(/\/cinemas$/);
  const venues = page.locator(".cinema-show-list .cinema-show-row");
  await expect(venues).toHaveCount(5);
  await venues.first().click();
  await expect(page).toHaveURL(/\/cinemas\/anna-nagar-silver$/);
  await expect(page.locator(".cinema-show-list .cinema-show-row").first()).toBeVisible();
});

test("the SQLite API serves five independent Chennai cinemas and show-specific inventory", async ({ request }) => {
  const cinemasResponse = await request.get(`${api}/cinemas`);
  expect(cinemasResponse.ok()).toBe(true);
  const cinemas = (await cinemasResponse.json()).items as Array<{ id: string }>;
  expect(cinemas).toHaveLength(5);
  const firstPage = await request.get(`${api}/cinemas?city=chennai&pageSize=2`);
  const firstPageBody = await firstPage.json();
  expect(firstPageBody.items).toHaveLength(2);
  expect(firstPageBody.nextPageToken).toBe("2");
  const secondPage = await request.get(`${api}/cinemas?city=Chennai&pageSize=2&pageToken=2`);
  const secondPageBody = await secondPage.json();
  expect(secondPageBody.items).toHaveLength(2);

  const [marinaResponse, tNagarResponse] = await Promise.all([
    request.get(`${api}/cinemas/marina-crown/shows`),
    request.get(`${api}/cinemas/t-nagar-royale/shows`),
  ]);
  expect(marinaResponse.ok()).toBe(true);
  expect(tNagarResponse.ok()).toBe(true);
  const marinaShows = (await marinaResponse.json()).items as Array<{ id: string }>;
  const tNagarShows = (await tNagarResponse.json()).items as Array<{ id: string }>;
  expect(marinaShows.length).toBeGreaterThan(1);
  expect(tNagarShows.length).toBeGreaterThan(1);
  expect(marinaShows[0].id).not.toBe(tNagarShows[0].id);

  const [marinaInventoryResponse, tNagarInventoryResponse] = await Promise.all([
    request.get(`${api}/shows/${marinaShows[0].id}/seats`),
    request.get(`${api}/shows/${tNagarShows[0].id}/seats`),
  ]);
  const marinaInventory = await marinaInventoryResponse.json();
  const tNagarInventory = await tNagarInventoryResponse.json();
  expect(marinaInventory.seats).toHaveLength(260);
  expect(tNagarInventory.seats).toHaveLength(198);
});

test("reservation holds are persistent, idempotent, conflict-safe, and payment stays unverified", async ({ request }) => {
  const showsResponse = await request.get(`${api}/cinemas/marina-crown/shows`);
  const shows = (await showsResponse.json()).items as Array<{ id: string }>;
  const showId = shows[0].id;
  const inventoryResponse = await request.get(`${api}/shows/${showId}/seats`);
  const inventory = await inventoryResponse.json();
  const seat = inventory.seats.find((item: { availability: string }) => item.availability === "available");
  if (!seat) throw new Error("The seeded auditorium must have an available seat.");

  const key = randomUUID();
  const reservationResponse = await request.post(`${api}/shows/${showId}/reservations`, {
    headers: { ...authorization, "Idempotency-Key": key },
    data: { seatIds: [seat.id] },
  });
  expect(reservationResponse.status()).toBe(201);
  const reservation = await reservationResponse.json();
  expect(reservation).toMatchObject({ showId, seatIds: [seat.id], status: "held", paymentStatus: "not_started" });

  const retryResponse = await request.post(`${api}/shows/${showId}/reservations`, {
    headers: { ...authorization, "Idempotency-Key": key },
    data: { seatIds: [seat.id] },
  });
  expect(await retryResponse.json()).toEqual(reservation);

  const conflictResponse = await request.post(`${api}/shows/${showId}/reservations`, {
    headers: { ...authorization, "Idempotency-Key": randomUUID() },
    data: { seatIds: [seat.id] },
  });
  expect(conflictResponse.status()).toBe(409);
  expect(await conflictResponse.json()).toMatchObject({ code: "SEAT_UNAVAILABLE", seatIds: [seat.id] });

  const orderResponse = await request.post(`${api}/bookings/${reservation.id}/payment-orders`, {
    headers: { ...authorization, "Idempotency-Key": randomUUID() },
  });
  expect(orderResponse.status()).toBe(201);
  expect(await orderResponse.json()).toMatchObject({ provider: "mock", amountMinor: reservation.amountMinor, checkoutUrl: null });
  const bookingResponse = await request.get(`${api}/bookings/${reservation.id}`, { headers: authorization });
  expect(await bookingResponse.json()).toMatchObject({ status: "held", paymentStatus: "pending" });

  const verificationResponse = await request.post(`${api}/bookings/${reservation.id}/payment-verifications`, {
    headers: { ...authorization, "Idempotency-Key": randomUUID() },
    data: { providerPaymentId: "untrusted-client-value" },
  });
  expect(verificationResponse.status()).toBe(409);
  expect(await verificationResponse.json()).toMatchObject({ code: "PAYMENT_PROVIDER_NOT_CONFIGURED" });

  const cancelResponse = await request.post(`${api}/bookings/${reservation.id}/cancellation-requests`, {
    headers: { ...authorization, "Idempotency-Key": randomUUID() },
  });
  expect(await cancelResponse.json()).toMatchObject({ status: "cancelled" });
  const refreshed = await request.get(`${api}/shows/${showId}/seats`);
  const releasedSeat = (await refreshed.json()).seats.find((item: { id: string }) => item.id === seat.id);
  expect(releasedSeat.availability).toBe("available");
});

test("protected booking routes reject requests without the demo bearer token", async ({ request }) => {
  const response = await request.get(`${api}/account/bookings`);
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
});
