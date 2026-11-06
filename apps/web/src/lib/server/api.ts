import "server-only";

import { mockCinemaApi } from "@/lib/api/mock-client";
import type { CinemaApi } from "@/lib/api/types";
import { getCinemaStore } from "./cinema-store";

const demoUserId = "local-demo-customer";
const useHttpApi = (process.env.NEXT_PUBLIC_API_MODE ?? (process.env.NODE_ENV === "development" ? "http" : "mock")) === "http";

function getSource(): CinemaApi {
  if (!useHttpApi) return mockCinemaApi;
  const store = getCinemaStore();
  return {
    listMovies: async () => store.listMovies(),
    getMovie: async (movieId) => store.getMovie(movieId),
    listMovieShows: async (movieId) => store.listMovieShows(movieId),
    listCinemas: async (query) => store.listCinemas(query),
    getCinema: async (cinemaId) => store.getCinema(cinemaId),
    listCinemaShows: async (cinemaId) => store.listCinemaShows(cinemaId),
    getShowtime: async (showId) => store.getShowtime(showId),
    getSeatInventory: async (showId) => store.getSeatInventory(showId),
    createReservation: async (showId, seatIds, key) =>
      store.createReservation(showId, seatIds, demoUserId, key),
    getBooking: async (bookingId) => store.getBooking(bookingId, demoUserId),
    createPaymentOrder: async (bookingId, key) =>
      store.createPaymentOrder(bookingId, demoUserId, key),
    verifyPayment: async (bookingId, providerPaymentId, key) => {
      void providerPaymentId;
      void key;
      return store.verifyPayment(bookingId, demoUserId);
    },
    cancelReservation: async (bookingId, key) =>
      store.cancelReservation(bookingId, demoUserId, key),
    requestRefund: async (bookingId, reason, key) => {
      void reason;
      void key;
      return store.requestRefund(bookingId, demoUserId);
    },
    listAccountBookings: async () => store.listAccountBookings(demoUserId),
    getTicket: async (bookingId) => store.getTicket(bookingId, demoUserId),
  } satisfies CinemaApi;
}

export const serverCinemaApi = getSource();

export function isServerUsingMockApi(): boolean {
  return !useHttpApi;
}
