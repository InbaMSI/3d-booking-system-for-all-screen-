import Link from "next/link";
import { notFound } from "next/navigation";
import { MoviePoster } from "@/components/movie-poster";
import { serverCinemaApi } from "@/lib/server/api";
import { ApiError, type Movie, type Showtime } from "@/lib/api/types";
import { formatPrice } from "@/lib/domain/seats";

export const dynamic = "force-dynamic";

export default async function MoviePage({ params }: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await params;
  let movie: Movie;
  let movieShows: Showtime[];
  try {
    [movie, movieShows] = await Promise.all([
      serverCinemaApi.getMovie(movieId),
      serverCinemaApi.listMovieShows(movieId),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <main className="detail-page">
      <Link className="back-link" href="/"><span aria-hidden="true">←</span> Back to films</Link>
      <section className="movie-detail">
        <MoviePoster className="detail-poster" movie={movie} />
        <div className="movie-detail-copy">
          <p className="eyebrow">NOW SHOWING · {movie.rating}</p>
          <h1>{movie.title}</h1>
          <p className="detail-meta">{movie.genres.join(" · ")} <span>·</span> {movie.runtimeMinutes} minutes</p>
          <p className="detail-synopsis">{movie.synopsis}</p>
          <div className="trailer-callout">
            <span className="play-orb" aria-hidden="true">▶</span>
            <span><strong>See the screen from your seat</strong><small>{movie.trailerUrl ? "Trailer available in the auditorium preview" : "No authorized trailer is configured for this title yet"}</small></span>
          </div>
          <div className="showtimes-heading"><div><p className="eyebrow">CHENNAI · TOMORROW</p><h2>Choose a showtime</h2></div></div>
          <div className="showtime-list">
            {movieShows.map((show) => (
              <Link className="showtime-card" href={`/shows/${show.id}/seats`} key={show.id}>
                <span><strong>{new Date(show.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</strong><small>{show.cinemaName} · {show.auditoriumName}</small></span>
                <span className="showtime-price">from {formatPrice(show.priceFromMinor)} <b aria-hidden="true">↗</b></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
