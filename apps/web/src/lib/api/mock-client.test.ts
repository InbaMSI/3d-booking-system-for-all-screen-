import { beforeEach, describe, expect, it } from "vitest";
import { mockCinemaApi } from "./mock-client";
import { ApiError } from "./types";

describe("mock cinema API boundary", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns a server-shaped reservation with a calculated price and expiry", async () => {
    const reservation = await mockCinemaApi.createReservation("show-the-last-orbit-1830", ["seat-A-01", "seat-C-02"], "reservation-test-1");
    expect(reservation.id).toMatch(/^mock-/);
    expect(reservation.amountMinor).toBe(82000);
    expect(Date.parse(reservation.expiresAt)).toBeGreaterThan(Date.now());
    expect(reservation.status).toBe("held");
    expect(reservation.paymentStatus).toBe("not_started");
  });

  it("returns a typed conflict for held or booked seats", async () => {
    await expect(mockCinemaApi.createReservation("show-the-last-orbit-1830", ["seat-C-12"], "reservation-test-2")).rejects.toMatchObject({
      status: 409,
      code: "SEAT_UNAVAILABLE",
      seatIds: ["seat-C-12"],
    } satisfies Partial<ApiError>);
  });

  it("does not issue a ticket from a pending or client-only payment status", async () => {
    const reservation = await mockCinemaApi.createReservation("show-the-last-orbit-1830", ["seat-A-01"], "reservation-test-3");
    await expect(mockCinemaApi.getTicket(reservation.id)).rejects.toMatchObject({ code: "TICKET_NOT_READY" });
  });

  it("reflects active mock holds in inventory and releases seats after cancellation", async () => {
    const showId = "show-the-last-orbit-1830";
    const reservation = await mockCinemaApi.createReservation(showId, ["seat-A-01"], "reservation-test-4");
    const heldInventory = await mockCinemaApi.getSeatInventory(showId);
    expect(heldInventory.seats.find((seat) => seat.id === "seat-A-01")?.availability).toBe("held");
    await expect(mockCinemaApi.createReservation(showId, ["seat-A-01"], "reservation-test-5")).rejects.toMatchObject({
      code: "SEAT_UNAVAILABLE",
      seatIds: ["seat-A-01"],
    });
    await mockCinemaApi.cancelReservation(reservation.id, "cancel-test-1");
    const availableInventory = await mockCinemaApi.getSeatInventory(showId);
    expect(availableInventory.seats.find((seat) => seat.id === "seat-A-01")?.availability).toBe("available");
  });

  it("expires timed-out mock holds and rejects payment order creation", async () => {
    const showId = "show-the-last-orbit-1830";
    const reservation = await mockCinemaApi.createReservation(showId, ["seat-A-02"], "reservation-test-6");
    window.localStorage.setItem(
      "cinema.mock.bookings",
      JSON.stringify([{ ...reservation, expiresAt: new Date(Date.now() - 1000).toISOString() }]),
    );
    await expect(mockCinemaApi.getBooking(reservation.id)).resolves.toMatchObject({ status: "expired" });
    await expect(mockCinemaApi.createPaymentOrder(reservation.id, "payment-test-1")).rejects.toMatchObject({
      code: "HOLD_EXPIRED",
      status: 409,
    });
  });

  it("returns server-shaped cancellation state without claiming payment", async () => {
    const reservation = await mockCinemaApi.createReservation("show-the-last-orbit-1830", ["seat-A-03"], "reservation-test-7");
    const cancelled = await mockCinemaApi.cancelReservation(reservation.id, "cancel-test-2");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.paymentStatus).toBe("not_started");
  });
});
