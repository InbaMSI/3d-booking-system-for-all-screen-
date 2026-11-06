import type { components } from "./generated";

export type Movie = components["schemas"]["Movie"];
export type Showtime = components["schemas"]["Showtime"];
export type Cinema = components["schemas"]["Cinema"];
export type Seat = components["schemas"]["Seat"];
type GeneratedSeatInventory = components["schemas"]["SeatInventory"];
export type SeatInventory = Omit<GeneratedSeatInventory, "screen"> & {
  screen: Omit<GeneratedSeatInventory["screen"], "center"> & {
    center: [number, number, number];
  };
};
export type Reservation = components["schemas"]["Reservation"];
export type PaymentOrder = components["schemas"]["PaymentOrder"];
export type Ticket = components["schemas"]["Ticket"];

export type SeatAvailability = Seat["availability"] | "selected";
export type BookingStatus = Reservation["status"];

export interface MovieShows {
  items: Showtime[];
}

export interface ReservationRequest {
  seatIds: string[];
}

export interface CinemaApi {
  listMovies(): Promise<Movie[]>;
  getMovie(movieId: string): Promise<Movie>;
  listMovieShows(movieId: string): Promise<Showtime[]>;
  listCinemas(query?: string): Promise<Cinema[]>;
  getCinema(cinemaId: string): Promise<Cinema>;
  listCinemaShows(cinemaId: string): Promise<Showtime[]>;
  getShowtime(showId: string): Promise<Showtime>;
  getSeatInventory(showId: string): Promise<SeatInventory>;
  createReservation(showId: string, seatIds: string[], idempotencyKey: string): Promise<Reservation>;
  getBooking(bookingId: string): Promise<Reservation>;
  createPaymentOrder(bookingId: string, idempotencyKey: string): Promise<PaymentOrder>;
  verifyPayment(bookingId: string, providerPaymentId: string, idempotencyKey: string): Promise<Reservation>;
  cancelReservation(bookingId: string, idempotencyKey: string): Promise<Reservation>;
  requestRefund(bookingId: string, reason: string, idempotencyKey: string): Promise<Reservation>;
  listAccountBookings(): Promise<Reservation[]>;
  getTicket(bookingId: string): Promise<Ticket>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly seatIds: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}
