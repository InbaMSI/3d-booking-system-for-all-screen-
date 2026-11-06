import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/types";
import { CinemaStore } from "./cinema-store";
import { initializeDatabase } from "./database";

const databases: Array<InstanceType<typeof Database>> = [];

function createStore(): CinemaStore {
  const database = new Database(":memory:");
  databases.push(database);
  initializeDatabase(database);
  return new CinemaStore(database);
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("SQLite cinema store", () => {
  it("seeds five Chennai cinemas with different show schedules and seat layouts", () => {
    const store = createStore();
    const cinemas = store.listCinemas("", "Chennai");

    expect(cinemas).toHaveLength(5);
    for (const cinema of cinemas) {
      expect(store.listCinemaShows(cinema.id).length).toBeGreaterThan(0);
    }

    const marinaShows = store.listCinemaShows("marina-crown");
    const tNagarShows = store.listCinemaShows("t-nagar-royale");
    const marinaInventory = store.getSeatInventory(marinaShows[0].id);
    const tNagarInventory = store.getSeatInventory(tNagarShows[0].id);
    expect(marinaInventory.seats).toHaveLength(260);
    expect(tNagarInventory.seats).toHaveLength(198);
    expect(marinaInventory.seats.map((seat) => seat.id)).not.toEqual(tNagarInventory.seats.map((seat) => seat.id));
    expect(marinaInventory.seats.some((seat) => seat.category === "lounger")).toBe(true);
    expect(marinaInventory.seats.some((seat) => seat.category === "elite")).toBe(true);
  });

  it("holds multiple seats atomically, is idempotent, and reports conflicts", () => {
    const store = createStore();
    const show = store.listCinemaShows("marina-crown")[0];
    const inventory = store.getSeatInventory(show.id);
    const available = inventory.seats.filter((seat) => seat.availability === "available").slice(0, 2);
    const seatIds = available.map((seat) => seat.id);
    const reservation = store.createReservation(show.id, seatIds, "customer-1", "reserve-1");

    expect(reservation).toMatchObject({
      showId: show.id,
      seatIds,
      amountMinor: available.reduce((total, seat) => total + seat.priceMinor, 0),
      status: "held",
      paymentStatus: "not_started",
    });
    expect(store.createReservation(show.id, seatIds, "customer-1", "reserve-1")).toEqual(reservation);
    expect(store.getSeatInventory(show.id).seats.filter((seat) => seatIds.includes(seat.id)).map((seat) => seat.availability))
      .toEqual(["held", "held"]);
    expect(() => store.createReservation(show.id, seatIds, "customer-2", "reserve-2"))
      .toThrow(expect.objectContaining({ code: "SEAT_UNAVAILABLE", status: 409, seatIds }));
  });

  it("rejects idempotency-key reuse with a different payload", () => {
    const store = createStore();
    const show = store.listCinemaShows("marina-crown")[0];
    const seats = store.getSeatInventory(show.id).seats.filter((seat) => seat.availability === "available").slice(0, 2);
    store.createReservation(show.id, [seats[0].id], "customer-1", "same-key");

    expect(() => store.createReservation(show.id, [seats[1].id], "customer-1", "same-key"))
      .toThrow(expect.objectContaining({ code: "IDEMPOTENCY_KEY_REUSED", status: 409 }));
  });

  it("keeps local payment pending and never issues a ticket from a client-supplied payment ID", () => {
    const store = createStore();
    const show = store.listCinemaShows("marina-crown")[0];
    const seat = store.getSeatInventory(show.id).seats.find((item) => item.availability === "available");
    if (!seat) throw new Error("Seed cinema must have an available seat.");
    const reservation = store.createReservation(show.id, [seat.id], "customer-1", "reserve-payment");
    const order = store.createPaymentOrder(reservation.id, "customer-1", "payment-order-1");

    expect(order).toMatchObject({ provider: "mock", amountMinor: seat.priceMinor, checkoutUrl: null });
    expect(store.getBooking(reservation.id, "customer-1").paymentStatus).toBe("pending");
    expect(() => store.verifyPayment(reservation.id, "customer-1"))
      .toThrow(expect.objectContaining({ code: "PAYMENT_PROVIDER_NOT_CONFIGURED", status: 409 }));
    expect(() => store.getTicket(reservation.id, "customer-1"))
      .toThrow(expect.objectContaining({ code: "TICKET_NOT_READY", status: 409 }));
  });

  it("isolates booking reads by customer and releases cancelled seats", () => {
    const store = createStore();
    const show = store.listCinemaShows("marina-crown")[0];
    const seat = store.getSeatInventory(show.id).seats.find((item) => item.availability === "available");
    if (!seat) throw new Error("Seed cinema must have an available seat.");
    const reservation = store.createReservation(show.id, [seat.id], "customer-1", "reserve-cancel");

    expect(() => store.getBooking(reservation.id, "customer-2"))
      .toThrow(expect.objectContaining({ code: "NOT_FOUND", status: 404 }));
    expect(store.cancelReservation(reservation.id, "customer-1", "cancel-1").status).toBe("cancelled");
    expect(store.getSeatInventory(show.id).seats.find((item) => item.id === seat.id)?.availability).toBe("available");
  });

  it("exposes typed API errors instead of hiding data failures", () => {
    const store = createStore();
    try {
      store.getShowtime("unknown-show");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 404, code: "NOT_FOUND" });
    }
  });
});
