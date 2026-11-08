import { createHash, randomUUID } from "node:crypto";
import type { Cinema, Movie, Reservation, Seat, SeatInventory, Showtime, Ticket, PaymentOrder } from "@/lib/api/types";
import { ApiError } from "@/lib/api/types";
import { createSeedCatalog } from "./seed-data";
import { getDatabase, type CinemaDatabase } from "./database";

interface ReservationRow {
  id: string;
  show_id: string;
  user_id: string;
  seat_ids: string;
  amount_minor: number;
  currency: string;
  expires_at: string;
  status: Reservation["status"];
  payment_status: Reservation["paymentStatus"];
}

interface IdempotencyRow {
  request_hash: string;
  response_payload: string;
}

const DEMO_SCREEN_VIDEO = "/Videos%20for%20movie/1000161237.mp4";

function withScreenVideo(movie: Movie): Movie {
  return { ...movie, trailerUrl: DEMO_SCREEN_VIDEO };
}

function seedDatabase(database: CinemaDatabase): void {
  const existing = database.prepare("SELECT COUNT(*) AS count FROM movies").get() as { count: number };
  if (existing.count > 0) return;
  const catalog = createSeedCatalog();
  const insertMovie = database.prepare("INSERT OR IGNORE INTO movies (id, payload) VALUES (?, ?)");
  const insertCinema = database.prepare("INSERT OR IGNORE INTO cinemas (id, payload) VALUES (?, ?)");
  const insertShow = database.prepare(
    "INSERT OR IGNORE INTO shows (id, movie_id, cinema_id, starts_at, payload) VALUES (?, ?, ?, ?, ?)",
  );
  const insertInventory = database.prepare("INSERT OR IGNORE INTO show_inventories (show_id, screen_payload) VALUES (?, ?)");
  const insertSeat = database.prepare(`
    INSERT OR IGNORE INTO seats
      (show_id, id, row_label, number, x, y, z, eye_height, price_minor, category, initial_availability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = database.transaction(() => {
    for (const movie of catalog.movies) insertMovie.run(movie.id, JSON.stringify(movie));
    for (const cinema of catalog.cinemas) insertCinema.run(cinema.id, JSON.stringify(cinema));
    for (const { show, inventory } of catalog.shows) {
      insertShow.run(show.id, show.movieId, show.cinemaId, show.startsAt, JSON.stringify(show));
      insertInventory.run(show.id, JSON.stringify(inventory.screen));
      for (const seat of inventory.seats) {
        insertSeat.run(
          show.id,
          seat.id,
          seat.row,
          seat.number,
          seat.x,
          seat.y,
          seat.z,
          seat.eyeHeight,
          seat.priceMinor,
          seat.category,
          seat.availability === "booked" ? "booked" : "available",
        );
      }
    }
  });
  seed();
}

function getCatalogRow<T>(database: CinemaDatabase, table: "movies" | "cinemas", id: string): T | undefined {
  const row = database.prepare(`SELECT payload FROM ${table} WHERE id = ?`).get(id) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as T : undefined;
}

function getReservationRow(database: CinemaDatabase, bookingId: string): ReservationRow | undefined {
  return database.prepare(`
    SELECT id, show_id, user_id, seat_ids, amount_minor, currency, expires_at, status, payment_status
    FROM reservations WHERE id = ?
  `).get(bookingId) as ReservationRow | undefined;
}

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    showId: row.show_id,
    seatIds: JSON.parse(row.seat_ids) as string[],
    amountMinor: row.amount_minor,
    currency: row.currency,
    expiresAt: row.expires_at,
    status: row.status,
    paymentStatus: row.payment_status,
  };
}

function expireReservations(database: CinemaDatabase, showId?: string): void {
  const expire = database.transaction(() => {
    const now = new Date().toISOString();
    const predicate = showId ? "show_id = ? AND " : "";
    const expired = database.prepare(
      `SELECT id FROM reservations WHERE ${predicate}status = 'held' AND expires_at <= ?`,
    ).all(...(showId ? [showId, now] : [now])) as Array<{ id: string }>;
    if (expired.length === 0) return;
    const ids = expired.map(({ id }) => id);
    const placeholders = ids.map(() => "?").join(",");
    database.prepare(`UPDATE reservations SET status = 'expired' WHERE id IN (${placeholders})`).run(...ids);
    database.prepare(`DELETE FROM reserved_seats WHERE reservation_id IN (${placeholders})`).run(...ids);
  });
  expire.immediate();
}

function idempotencyHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function readIdempotent<T>(
  database: CinemaDatabase,
  userId: string,
  operation: string,
  key: string,
  requestHash: string,
): T | null {
  const row = database.prepare(`
    SELECT request_hash, response_payload FROM idempotency_records
    WHERE user_id = ? AND operation = ? AND idempotency_key = ?
  `).get(userId, operation, key) as IdempotencyRow | undefined;
  if (!row) return null;
  if (row.request_hash !== requestHash) {
    throw new ApiError("This idempotency key was already used for a different request.", "IDEMPOTENCY_KEY_REUSED", 409);
  }
  return JSON.parse(row.response_payload) as T;
}

function saveIdempotent(
  database: CinemaDatabase,
  userId: string,
  operation: string,
  key: string,
  requestHash: string,
  response: unknown,
): void {
  database.prepare(`
    INSERT INTO idempotency_records
      (user_id, operation, idempotency_key, request_hash, response_payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, operation, key, requestHash, JSON.stringify(response), new Date().toISOString());
}

function requireIdempotencyKey(key: string): void {
  if (!key || key.length > 128) {
    throw new ApiError("A valid Idempotency-Key header is required.", "IDEMPOTENCY_KEY_REQUIRED", 400);
  }
}

export class CinemaStore {
  constructor(private readonly database: CinemaDatabase = getDatabase()) {
    seedDatabase(this.database);
  }

  listMovies(): Movie[] {
    return (this.database.prepare("SELECT payload FROM movies ORDER BY id").all() as Array<{ payload: string }>)
      .map(({ payload }) => withScreenVideo(JSON.parse(payload) as Movie));
  }

  getMovie(movieId: string): Movie {
    const movie = getCatalogRow<Movie>(this.database, "movies", movieId);
    if (!movie) throw new ApiError("Movie not found.", "NOT_FOUND", 404);
    return withScreenVideo(movie);
  }

  listMovieShows(movieId: string): Showtime[] {
    if (!getCatalogRow<Movie>(this.database, "movies", movieId)) {
      throw new ApiError("Movie not found.", "NOT_FOUND", 404);
    }
    return this.listShows("movie_id", movieId);
  }

  listCinemas(query = "", city = ""): Cinema[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const normalizedCity = city.trim().toLocaleLowerCase();
    return (this.database.prepare("SELECT payload FROM cinemas ORDER BY id").all() as Array<{ payload: string }>)
      .map(({ payload }) => JSON.parse(payload) as Cinema)
      .filter((cinema) => {
        const searchable = `${cinema.name} ${cinema.address}`.toLocaleLowerCase();
        return (!normalizedQuery || searchable.includes(normalizedQuery))
          && (!normalizedCity || searchable.includes(normalizedCity));
      });
  }

  getCinema(cinemaId: string): Cinema {
    const cinema = getCatalogRow<Cinema>(this.database, "cinemas", cinemaId);
    if (!cinema) throw new ApiError("Cinema not found.", "NOT_FOUND", 404);
    return cinema;
  }

  listCinemaShows(cinemaId: string): Showtime[] {
    if (!getCatalogRow<Cinema>(this.database, "cinemas", cinemaId)) {
      throw new ApiError("Cinema not found.", "NOT_FOUND", 404);
    }
    return this.listShows("cinema_id", cinemaId);
  }

  getShowtime(showId: string): Showtime {
    const row = this.database.prepare("SELECT payload FROM shows WHERE id = ?").get(showId) as { payload: string } | undefined;
    if (!row) throw new ApiError("Showtime not found.", "NOT_FOUND", 404);
    return JSON.parse(row.payload) as Showtime;
  }

  getSeatInventory(showId: string): SeatInventory {
    this.getShowtime(showId);
    expireReservations(this.database, showId);
    const screenRow = this.database.prepare("SELECT screen_payload FROM show_inventories WHERE show_id = ?").get(showId) as { screen_payload: string } | undefined;
    if (!screenRow) throw new ApiError("Seat inventory not found.", "NOT_FOUND", 404);
    const rows = this.database.prepare(`
      SELECT s.id, s.row_label, s.number, s.x, s.y, s.z, s.eye_height, s.price_minor, s.category,
        CASE
          WHEN s.initial_availability = 'booked' THEN 'booked'
          WHEN r.status = 'confirmed' THEN 'booked'
          WHEN r.status = 'held' THEN 'held'
          ELSE 'available'
        END AS availability
      FROM seats s
      LEFT JOIN reserved_seats rs ON rs.show_id = s.show_id AND rs.seat_id = s.id
      LEFT JOIN reservations r ON r.id = rs.reservation_id
      WHERE s.show_id = ?
      ORDER BY s.row_label, s.number
    `).all(showId) as Array<{
      id: string; row_label: string; number: number; x: number; y: number; z: number;
      eye_height: number; price_minor: number; category: Seat["category"]; availability: Seat["availability"];
    }>;
    return {
      showId,
      screen: JSON.parse(screenRow.screen_payload) as SeatInventory["screen"],
      seats: rows.map((row) => ({
        id: row.id,
        row: row.row_label,
        number: row.number,
        x: row.x,
        y: row.y,
        z: row.z,
        eyeHeight: row.eye_height,
        priceMinor: row.price_minor,
        category: row.category,
        availability: row.availability,
      })),
    };
  }

  createReservation(showId: string, seatIds: string[], userId: string, idempotencyKey: string): Reservation {
    requireIdempotencyKey(idempotencyKey);
    if (seatIds.length === 0 || new Set(seatIds).size !== seatIds.length) {
      throw new ApiError("Select one or more unique seats.", "INVALID_SEATS", 400);
    }
    this.getShowtime(showId);
    expireReservations(this.database, showId);
    const requestHash = idempotencyHash({ showId, seatIds });
    const create = this.database.transaction(() => {
      const previous = readIdempotent<Reservation>(this.database, userId, "createReservation", idempotencyKey, requestHash);
      if (previous) return previous;
      const placeholders = seatIds.map(() => "?").join(",");
      const rows = this.database.prepare(`
        SELECT s.id, s.price_minor, s.initial_availability, rs.reservation_id
        FROM seats s
        LEFT JOIN reserved_seats rs ON rs.show_id = s.show_id AND rs.seat_id = s.id
        WHERE s.show_id = ? AND s.id IN (${placeholders})
      `).all(showId, ...seatIds) as Array<{
        id: string; price_minor: number; initial_availability: "available" | "booked"; reservation_id: string | null;
      }>;
      if (rows.length !== seatIds.length) {
        throw new ApiError("One or more selected seats do not exist in this auditorium.", "INVALID_SEATS", 400);
      }
      const conflicts = rows
        .filter((seat) => seat.initial_availability === "booked" || seat.reservation_id !== null)
        .map((seat) => seat.id);
      if (conflicts.length > 0) {
        throw new ApiError("Some seats are no longer available. Review the refreshed seat map.", "SEAT_UNAVAILABLE", 409, conflicts);
      }
      const show = this.getShowtime(showId);
      const reservation: Reservation = {
        id: randomUUID(),
        showId,
        seatIds,
        amountMinor: rows.reduce((amount, seat) => amount + seat.price_minor, 0),
        currency: show.currency,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        status: "held",
        paymentStatus: "not_started",
      };
      this.database.prepare(`
        INSERT INTO reservations
          (id, show_id, user_id, seat_ids, amount_minor, currency, expires_at, status, payment_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reservation.id,
        showId,
        userId,
        JSON.stringify(seatIds),
        reservation.amountMinor,
        reservation.currency,
        reservation.expiresAt,
        reservation.status,
        reservation.paymentStatus,
        new Date().toISOString(),
      );
      const insertReservedSeat = this.database.prepare("INSERT INTO reserved_seats (show_id, seat_id, reservation_id) VALUES (?, ?, ?)");
      for (const seatId of seatIds) insertReservedSeat.run(showId, seatId, reservation.id);
      saveIdempotent(this.database, userId, "createReservation", idempotencyKey, requestHash, reservation);
      return reservation;
    });
    return create.immediate();
  }

  getBooking(bookingId: string, userId: string): Reservation {
    expireReservations(this.database);
    const row = getReservationRow(this.database, bookingId);
    if (!row || row.user_id !== userId) throw new ApiError("Reservation not found.", "NOT_FOUND", 404);
    return toReservation(row);
  }

  createPaymentOrder(bookingId: string, userId: string, idempotencyKey: string): PaymentOrder {
    requireIdempotencyKey(idempotencyKey);
    expireReservations(this.database);
    const requestHash = idempotencyHash({ bookingId });
    const create = this.database.transaction(() => {
      const previous = readIdempotent<PaymentOrder>(this.database, userId, "createPaymentOrder", idempotencyKey, requestHash);
      if (previous) return previous;
      const booking = this.requireOwnedBooking(bookingId, userId);
      if (booking.status !== "held" || Date.parse(booking.expiresAt) <= Date.now()) {
        throw new ApiError("This reservation has expired or is no longer payable.", "HOLD_EXPIRED", 409);
      }
      const order: PaymentOrder = {
        orderId: `demo-order-${booking.id}`,
        amountMinor: booking.amountMinor,
        currency: booking.currency,
        provider: "mock",
        checkoutUrl: null,
      };
      this.database.prepare("UPDATE reservations SET payment_status = 'pending' WHERE id = ?").run(bookingId);
      saveIdempotent(this.database, userId, "createPaymentOrder", idempotencyKey, requestHash, order);
      return order;
    });
    return create.immediate();
  }

  verifyPayment(bookingId: string, userId: string): Reservation {
    this.requireOwnedBooking(bookingId, userId);
    throw new ApiError(
      "Payment verification is unavailable in this demo. A client response cannot confirm a booking.",
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      409,
    );
  }

  cancelReservation(bookingId: string, userId: string, idempotencyKey: string): Reservation {
    requireIdempotencyKey(idempotencyKey);
    expireReservations(this.database);
    const requestHash = idempotencyHash({ bookingId });
    const cancel = this.database.transaction(() => {
      const previous = readIdempotent<Reservation>(this.database, userId, "cancelReservation", idempotencyKey, requestHash);
      if (previous) return previous;
      const booking = this.requireOwnedBooking(bookingId, userId);
      if (booking.status !== "held") {
        throw new ApiError("This reservation cannot be cancelled in its current state.", "CANCELLATION_NOT_ALLOWED", 409);
      }
      this.database.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(bookingId);
      this.database.prepare("DELETE FROM reserved_seats WHERE reservation_id = ?").run(bookingId);
      const cancelled = { ...booking, status: "cancelled" as const };
      saveIdempotent(this.database, userId, "cancelReservation", idempotencyKey, requestHash, cancelled);
      return cancelled;
    });
    return cancel.immediate();
  }

  requestRefund(bookingId: string, userId: string): Reservation {
    this.requireOwnedBooking(bookingId, userId);
    throw new ApiError("Refund processing is not configured for this local demo.", "REFUND_NOT_CONFIGURED", 409);
  }

  listAccountBookings(userId: string): Reservation[] {
    expireReservations(this.database);
    return (this.database.prepare(`
      SELECT id, show_id, user_id, seat_ids, amount_minor, currency, expires_at, status, payment_status
      FROM reservations WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId) as ReservationRow[]).map(toReservation);
  }

  getTicket(bookingId: string, userId: string): Ticket {
    const booking = this.requireOwnedBooking(bookingId, userId);
    if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
      throw new ApiError("A ticket is available only after payment is verified by the server.", "TICKET_NOT_READY", 409);
    }
    return {
      id: `ticket-${booking.id}`,
      bookingId,
      issuedAt: new Date().toISOString(),
      seatIds: booking.seatIds,
    };
  }

  private requireOwnedBooking(bookingId: string, userId: string): Reservation {
    const row = getReservationRow(this.database, bookingId);
    if (!row || row.user_id !== userId) throw new ApiError("Reservation not found.", "NOT_FOUND", 404);
    return toReservation(row);
  }

  private listShows(column: "movie_id" | "cinema_id", value: string): Showtime[] {
    return (this.database.prepare(`SELECT payload FROM shows WHERE ${column} = ? ORDER BY starts_at`).all(value) as Array<{ payload: string }>)
      .map(({ payload }) => JSON.parse(payload) as Showtime);
  }
}

let store: CinemaStore | undefined;

export function getCinemaStore(): CinemaStore {
  store ??= new CinemaStore();
  return store;
}
