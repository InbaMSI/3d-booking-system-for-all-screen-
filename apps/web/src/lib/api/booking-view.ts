import { cinemaApi } from "./client";
import type { Cinema, Movie, Reservation, Showtime } from "./types";

export interface BookingView {
  booking: Reservation;
  show: Showtime;
  movie: Movie;
  cinema: Cinema;
}

export async function getBookingView(bookingId: string): Promise<BookingView> {
  const booking = await cinemaApi.getBooking(bookingId);
  const show = await cinemaApi.getShowtime(booking.showId);
  const [movie, cinema] = await Promise.all([
    cinemaApi.getMovie(show.movieId),
    cinemaApi.getCinema(show.cinemaId),
  ]);
  return { booking, show, movie, cinema };
}
