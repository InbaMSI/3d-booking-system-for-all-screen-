import { notFound } from "next/navigation";
import { SeatBooking } from "@/components/seats/seat-booking";
import { serverCinemaApi } from "@/lib/server/api";
import { ApiError, type Movie, type Showtime } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export default async function SeatSelectionPage({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  let show: Showtime;
  let movie: Movie;
  try {
    show = await serverCinemaApi.getShowtime(showId);
    movie = await serverCinemaApi.getMovie(show.movieId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return <SeatBooking movie={movie} show={show} />;
}
