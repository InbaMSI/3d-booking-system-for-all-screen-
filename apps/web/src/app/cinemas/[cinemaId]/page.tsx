import Link from "next/link";
import { notFound } from "next/navigation";
import { serverCinemaApi } from "@/lib/server/api";
import { ApiError, type Cinema, type Showtime } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export default async function CinemaPage({ params }: { params: Promise<{ cinemaId: string }> }) {
  const { cinemaId } = await params;
  let cinema: Cinema;
  let cinemaShows: Showtime[];
  try {
    [cinema, cinemaShows] = await Promise.all([
      serverCinemaApi.getCinema(cinemaId),
      serverCinemaApi.listCinemaShows(cinemaId),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const showsWithMovies = await Promise.all(
    cinemaShows.map(async (show) => ({ show, movie: await serverCinemaApi.getMovie(show.movieId) })),
  );
  return (
    <main className="detail-page cinema-page">
      <Link className="back-link" href="/cinemas"><span aria-hidden="true">←</span> All Chennai cinemas</Link>
      <p className="eyebrow">YOUR LOCAL PICTURE HOUSE</p>
      <h1>{cinema.name}<span className="accent-dot">.</span></h1>
      <p className="detail-synopsis">{cinema.address}</p>
      <div className="cinema-feature">
        <div className="cinema-feature-art"><span>{cinema.auditoriumName}</span><i aria-hidden="true" /></div>
        <div><p className="eyebrow">ONE ROOM. ALL THE MAGIC.</p><h2>{cinema.auditoriumName}</h2><p>A carefully tuned auditorium, an expansive screen, and a view worth choosing. Preview your seat before you book.</p><span className="asset-note">Auditorium: procedural preview · no production model asset provided</span></div>
      </div>
      <section className="cinema-shows">
        <p className="eyebrow">COMING UP TOMORROW</p>
        <div className="cinema-show-list">
          {showsWithMovies.map(({ show, movie }) => (
            <Link className="cinema-show-row" href={`/shows/${show.id}/seats`} key={show.id}>
              <span><strong>{movie.title}</strong><small>{new Date(show.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {show.auditoriumName}</small></span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
