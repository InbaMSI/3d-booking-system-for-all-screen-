import Link from "next/link";
import { DiscoverySearch } from "@/components/discovery-search";
import { MoviePoster } from "@/components/movie-poster";
import { HeroLinkButton } from "@/components/hero-link-button";
import { serverCinemaApi } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const movies = await serverCinemaApi.listMovies();
  const featured = movies[0];
  const featuredShow = featured ? (await serverCinemaApi.listMovieShows(featured.id))[0] : undefined;
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> THE CINEMA, REIMAGINED</p>
          <h1>Make a night<br />of <em>the movies.</em></h1>
          <p className="hero-description">Find your next favourite. Pick your perfect seat. See the view before the lights go down.</p>
          <div className="hero-actions">
            <HeroLinkButton href={featured ? `/movies/${featured.id}` : "/"}>Find your film <span aria-hidden="true">↗</span></HeroLinkButton>
            <Link className="text-link" href="/cinemas">Explore cinemas <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hero-meta"><span>NOW SHOWING</span><span className="meta-rule" /> <span>{movies.length} films · Chennai</span></div>
        </div>
        <div className="hero-art">
          <div className="hero-glow" />
          {featured ? (
            <>
              <MoviePoster className="feature-poster" movie={featured} />
              <div className="poster-caption">
                <span className="caption-index">01 / FEATURED</span>
                <span>{featured.title}</span>
                <span className="caption-runtime">{featured.runtimeMinutes} MIN · {featured.rating}</span>
              </div>
              {featuredShow && <Link className="floating-showtime" href={`/shows/${featuredShow.id}/seats`}>
                <span className="floating-label">TONIGHT · {new Date(featuredShow.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                <span className="floating-title">{featuredShow.auditoriumName} <span aria-hidden="true">↗</span></span>
              </Link>}
            </>
          ) : <p className="empty-search">No films are currently showing.</p>}
        </div>
        <div className="hero-side-note">A BETTER VIEW<br />OF MOVIE NIGHT</div>
      </section>
      <section aria-labelledby="now-showing-title" className="catalog-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE GOOD STUFF</p>
            <h2 id="now-showing-title">Now showing<span className="accent-dot">.</span></h2>
          </div>
          <span className="section-note">Choose a film. We’ll find the seat.</span>
        </div>
        <DiscoverySearch movies={movies} />
      </section>
      <section className="location-band">
        <span className="location-icon" aria-hidden="true">⌖</span>
        <div><p className="eyebrow">YOUR LOCAL PICTURE HOUSE</p><p>Showing in <strong>Chennai</strong></p></div>
        <Link className="text-link" href="/cinemas">Browse cinemas <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
