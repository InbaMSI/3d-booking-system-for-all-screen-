import { cinemas, mockSeatInventory, movies, sampleReservation, shows } from "./mock-data";
import { ApiError, type CinemaApi, type PaymentOrder, type Reservation, type Ticket } from "./types";

const MOCK_BOOKINGS_KEY = "cinema.mock.bookings";

function isReservation(value: unknown): value is Reservation {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.showId === "string" &&
    Array.isArray(record.seatIds) &&
    record.seatIds.every((seatId) => typeof seatId === "string") &&
    typeof record.amountMinor === "number" &&
    Number.isInteger(record.amountMinor) &&
    typeof record.currency === "string" &&
    /^[A-Z]{3}$/.test(record.currency) &&
    typeof record.expiresAt === "string" &&
    Number.isFinite(Date.parse(record.expiresAt)) &&
    ["held", "expired", "confirmed", "cancelled"].includes(String(record.status)) &&
    ["not_started", "pending", "failed", "paid"].includes(String(record.paymentStatus))
  );
}

function readBookings(): Reservation[] {
  if (typeof window === "undefined") return [sampleReservation];
  const value = window.localStorage.getItem(MOCK_BOOKINGS_KEY);
  if (!value) return [sampleReservation];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every(isReservation)) return parsed;
    throw new Error("Stored mock reservations must be an array.");
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Could not read mock reservations.",
      "MOCK_STORAGE_ERROR",
      500,
    );
  }
}

function writeBookings(bookings: Reservation[]): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MOCK_BOOKINGS_KEY, JSON.stringify(bookings));
  }
}

export const mockCinemaApi: CinemaApi = {
  async listMovies() {
    return movies;
  },
  async getMovie(movieId) {
    const movie = movies.find((item) => item.id === movieId);
    if (!movie) throw new ApiError("Movie not found.", "NOT_FOUND", 404);
    return movie;
  },
  async listMovieShows(movieId) {
    return shows.filter((show) => show.movieId === movieId);
  },
  async listCinemas(query) {
    const normalized = query?.trim().toLocaleLowerCase();
    return normalized
      ? cinemas.filter((cinema) => `${cinema.name} ${cinema.address}`.toLocaleLowerCase().includes(normalized))
      : cinemas;
  },
  async getCinema(cinemaId) {
    const cinema = cinemas.find((item) => item.id === cinemaId);
    if (!cinema) throw new ApiError("Cinema not found.", "NOT_FOUND", 404);
    return cinema;
  },
  async listCinemaShows(cinemaId) {
    if (!cinemas.some((cinema) => cinema.id === cinemaId)) {
      throw new ApiError("Cinema not found.", "NOT_FOUND", 404);
    }
    return shows.filter((show) => show.cinemaId === cinemaId);
  },
  async getShowtime(showId) {
    const show = shows.find((item) => item.id === showId);
    if (!show) throw new ApiError("Showtime not found.", "NOT_FOUND", 404);
    return show;
  },
  async getSeatInventory(showId) {
    if (!shows.some((show) => show.id === showId)) {
      throw new ApiError("Showtime not found.", "NOT_FOUND", 404);
    }
    const activeHolds = new Set(
      readBookings()
        .filter((booking) => booking.showId === showId && booking.status === "held" && Date.parse(booking.expiresAt) > Date.now())
        .flatMap((booking) => booking.seatIds),
    );
    return {
      ...mockSeatInventory,
      showId,
      seats: mockSeatInventory.seats.map((seat) =>
        activeHolds.has(seat.id) && seat.availability === "available"
          ? { ...seat, availability: "held" }
          : seat,
      ),
    };
  },
  async createReservation(showId, seatIds) {
    if (!shows.some((show) => show.id === showId)) {
      throw new ApiError("Showtime not found.", "NOT_FOUND", 404);
    }
    const activeHolds = new Set(
      readBookings()
        .filter((booking) => booking.showId === showId && booking.status === "held" && Date.parse(booking.expiresAt) > Date.now())
        .flatMap((booking) => booking.seatIds),
    );
    const seats = mockSeatInventory.seats.map((seat) =>
      activeHolds.has(seat.id) && seat.availability === "available"
        ? { ...seat, availability: "held" }
        : seat,
    );
    const requested = seats.filter((seat) => seatIds.includes(seat.id));
    if (requested.length !== seatIds.length || seatIds.length === 0) {
      throw new ApiError("Select one or more valid seats.", "INVALID_SEATS", 400);
    }
    const conflicts = requested.filter((seat) => seat.availability !== "available").map((seat) => seat.id);
    if (conflicts.length > 0) {
      throw new ApiError(
        "Some seats are no longer available. Review the refreshed seat map.",
        "SEAT_UNAVAILABLE",
        409,
        conflicts,
      );
    }
    const reservation: Reservation = {
      id: `mock-${crypto.randomUUID()}`,
      showId,
      seatIds,
      amountMinor: requested.reduce((total, seat) => total + seat.priceMinor, 0),
      currency: "INR",
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      status: "held",
      paymentStatus: "not_started",
    };
    writeBookings([...readBookings(), reservation]);
    return reservation;
  },
  async getBooking(bookingId) {
    const booking = readBookings().find((item) => item.id === bookingId);
    if (!booking) throw new ApiError("Reservation not found.", "NOT_FOUND", 404);
    if (booking.status === "held" && Date.parse(booking.expiresAt) <= Date.now()) {
      const expired: Reservation = { ...booking, status: "expired" };
      writeBookings(readBookings().map((item) => item.id === bookingId ? expired : item));
      return expired;
    }
    return booking;
  },
  async createPaymentOrder(bookingId) {
    const booking = await this.getBooking(bookingId);
    if (booking.status !== "held" || new Date(booking.expiresAt).getTime() <= Date.now()) {
      throw new ApiError("This reservation has expired.", "HOLD_EXPIRED", 409);
    }
    const order: PaymentOrder = {
      orderId: `mock-order-${booking.id}`,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      provider: "mock",
      checkoutUrl: null,
    };
    writeBookings(
      readBookings().map((item) =>
        item.id === bookingId ? { ...item, paymentStatus: "pending" } : item,
      ),
    );
    return order;
  },
  async verifyPayment(bookingId) {
    return this.getBooking(bookingId);
  },
  async cancelReservation(bookingId) {
    const booking = await this.getBooking(bookingId);
    if (booking.status !== "held") {
      throw new ApiError("This reservation cannot be cancelled in its current state.", "CANCELLATION_NOT_ALLOWED", 409);
    }
    const cancelled: Reservation = { ...booking, status: "cancelled" };
    writeBookings(readBookings().map((item) => item.id === bookingId ? cancelled : item));
    return cancelled;
  },
  async requestRefund(bookingId) {
    const booking = await this.getBooking(bookingId);
    throw new ApiError(
      `Refund policy is evaluated by the backend for booking ${booking.id}.`,
      "REFUND_NOT_CONFIGURED",
      409,
    );
  },
  async listAccountBookings() {
    return readBookings();
  },
  async getTicket(bookingId) {
    const booking = await this.getBooking(bookingId);
    if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
      throw new ApiError("A ticket is available after payment is verified.", "TICKET_NOT_READY", 409);
    }
    const ticket: Ticket = {
      id: `ticket-${booking.id}`,
      bookingId,
      issuedAt: new Date().toISOString(),
      seatIds: booking.seatIds,
    };
    return ticket;
  },
};
