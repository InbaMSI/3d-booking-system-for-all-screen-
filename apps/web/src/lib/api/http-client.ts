import type { CinemaApi, Cinema, Movie, SeatInventory, Showtime, Reservation, PaymentOrder, Ticket } from "./types";
import { ApiError } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const DEMO_TOKEN = process.env.NEXT_PUBLIC_DEMO_BEARER_TOKEN
  ?? (process.env.NODE_ENV === "development" ? "local-chennai-demo-token" : "");

function authHeaders(): Record<string, string> {
  if (!DEMO_TOKEN) throw new Error("Customer authentication is not configured for the cinema API.");
  return { Authorization: `Bearer ${DEMO_TOKEN}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const errorBody =
      typeof body === "object" && body !== null && "message" in body
        ? (body as { message?: unknown; code?: unknown; seatIds?: unknown })
        : {};
    throw new ApiError(
      typeof errorBody.message === "string" ? errorBody.message : "The cinema service could not complete this request.",
      typeof errorBody.code === "string" ? errorBody.code : "API_ERROR",
      response.status,
      Array.isArray(errorBody.seatIds) ? errorBody.seatIds.filter((id): id is string => typeof id === "string") : [],
    );
  }
  return (await response.json()) as T;
}

export const httpCinemaApi: CinemaApi = {
  async listMovies() {
    return (await request<{ items: Movie[] }>("/movies")).items;
  },
  getMovie(movieId): Promise<Movie> {
    return request<Movie>(`/movies/${encodeURIComponent(movieId)}`);
  },
  async listMovieShows(movieId) {
    return (await request<{ items: Showtime[] }>(
      `/movies/${encodeURIComponent(movieId)}/shows`,
    )).items;
  },
  async listCinemas(query) {
    const search = query ? `?q=${encodeURIComponent(query)}` : "";
    return (await request<{ items: Cinema[] }>(`/cinemas${search}`)).items;
  },
  getCinema(cinemaId): Promise<Cinema> {
    return request<Cinema>(`/cinemas/${encodeURIComponent(cinemaId)}`);
  },
  async listCinemaShows(cinemaId) {
    return (await request<{ items: Showtime[] }>(`/cinemas/${encodeURIComponent(cinemaId)}/shows`)).items;
  },
  getShowtime(showId): Promise<Showtime> {
    return request<Showtime>(`/shows/${encodeURIComponent(showId)}`);
  },
  getSeatInventory(showId): Promise<SeatInventory> {
    return request<SeatInventory>(`/shows/${encodeURIComponent(showId)}/seats`);
  },
  createReservation(showId, seatIds, idempotencyKey): Promise<Reservation> {
    return request<Reservation>(`/shows/${encodeURIComponent(showId)}/reservations`, {
      method: "POST",
      headers: { ...authHeaders(), "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ seatIds }),
    });
  },
  getBooking(bookingId): Promise<Reservation> {
    return request<Reservation>(`/bookings/${encodeURIComponent(bookingId)}`, { headers: authHeaders() });
  },
  createPaymentOrder(bookingId, idempotencyKey): Promise<PaymentOrder> {
    return request<PaymentOrder>(`/bookings/${encodeURIComponent(bookingId)}/payment-orders`, {
      method: "POST",
      headers: { ...authHeaders(), "Idempotency-Key": idempotencyKey },
    });
  },
  verifyPayment(bookingId, providerPaymentId, idempotencyKey): Promise<Reservation> {
    return request<Reservation>(`/bookings/${encodeURIComponent(bookingId)}/payment-verifications`, {
      method: "POST",
      headers: { ...authHeaders(), "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ providerPaymentId }),
    });
  },
  cancelReservation(bookingId, idempotencyKey): Promise<Reservation> {
    return request<Reservation>(`/bookings/${encodeURIComponent(bookingId)}/cancellation-requests`, {
      method: "POST",
      headers: { ...authHeaders(), "Idempotency-Key": idempotencyKey },
    });
  },
  requestRefund(bookingId, reason, idempotencyKey): Promise<Reservation> {
    return request<Reservation>(`/bookings/${encodeURIComponent(bookingId)}/refund-requests`, {
      method: "POST",
      headers: { ...authHeaders(), "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ reason }),
    });
  },
  async listAccountBookings() {
    return (await request<{ items: Reservation[] }>(
      "/account/bookings",
      { headers: authHeaders() },
    )).items;
  },
  getTicket(bookingId): Promise<Ticket> {
    return request<Ticket>(`/bookings/${encodeURIComponent(bookingId)}/ticket`, { headers: authHeaders() });
  },
};
