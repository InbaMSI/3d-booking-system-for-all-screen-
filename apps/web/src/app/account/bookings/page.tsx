import Link from "next/link";
import { MoviePoster } from "@/components/movie-poster";
import { usingMockApi } from "@/lib/api/client";
import { serverCinemaApi } from "@/lib/server/api";
import { formatPrice } from "@/lib/domain/seats";

export const dynamic = "force-dynamic";

export default async function AccountBookingsPage() {
  const bookings = await serverCinemaApi.listAccountBookings();
  const history = await Promise.all(bookings.map(async (booking) => {
    const show = await serverCinemaApi.getShowtime(booking.showId);
    const movie = await serverCinemaApi.getMovie(show.movieId);
    return { booking, show, movie };
  }));
  return (
    <main className="detail-page account-page">
      <p className="eyebrow">YOUR REEL. ACCOUNT</p>
      <h1>My bookings<span className="accent-dot">.</span></h1>
      <p className="detail-synopsis">Your reservations and tickets, all in one place.</p>
      {usingMockApi
        ? <p className="demo-banner"><strong>DEMO · MOCK DATA</strong> Customer authentication and live booking history are not connected.</p>
        : <p className="demo-banner"><strong>DEMO · LOCAL CUSTOMER</strong> This development-only account uses one shared demo identity. It is not private customer authentication.</p>}
      <section aria-label="Booking history" className="booking-history">
        {history.length ? history.map(({ booking, show, movie }) => (
          <article className="history-card" key={booking.id}>
            <MoviePoster className="history-poster" movie={movie} />
            <div className="history-main"><p className="eyebrow">RESERVATION · {booking.status.toUpperCase()}</p><h2>{movie.title}</h2><p>{new Date(show.startsAt).toLocaleDateString("en-IN")} · {new Date(show.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {show.auditoriumName}</p><p>Seats {booking.seatIds.join(", ")} · {formatPrice(booking.amountMinor, booking.currency)}</p></div>
            <Link className="text-link" href={`/bookings/${encodeURIComponent(booking.id)}`}>View status <span aria-hidden="true">→</span></Link>
          </article>
        )) : (
          <div className="empty-bookings"><h2>No bookings yet.</h2><p>Your next great movie night is waiting.</p><Link className="button button-primary" href="/">Explore films <span aria-hidden="true">→</span></Link></div>
        )}
        <Link className="text-link browse-link" href="/">Find another film <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
