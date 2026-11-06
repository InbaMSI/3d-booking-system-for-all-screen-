import Link from "next/link";
import { serverCinemaApi } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export default async function CinemasPage() {
  const cinemas = await serverCinemaApi.listCinemas("Chennai");
  const venues = await Promise.all(cinemas.map(async (cinema) => ({
    cinema,
    shows: await serverCinemaApi.listCinemaShows(cinema.id),
  })));

  return (
    <main className="detail-page cinema-page">
      <p className="eyebrow">CHENNAI · FIVE DEMO VENUES</p>
      <h1>Find your <em>theatre.</em></h1>
      <p className="detail-synopsis">Browse each venue’s screenings, then choose a show to explore its own seat layout.</p>
      <section aria-label="Chennai cinemas" className="cinema-shows">
        <p className="eyebrow">CINEMAS AND UPCOMING SHOWS</p>
        <div className="cinema-show-list">
          {venues.map(({ cinema, shows }) => (
            <Link className="cinema-show-row" href={`/cinemas/${cinema.id}`} key={cinema.id}>
              <span>
                <strong>{cinema.name}</strong>
                <small>{cinema.address} · {cinema.auditoriumName} · {shows.length} screenings</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
