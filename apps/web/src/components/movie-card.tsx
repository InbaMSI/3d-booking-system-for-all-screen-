import Link from "next/link";
import type { Movie } from "@/lib/api/types";
import { MoviePoster } from "./movie-poster";

export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <article className="movie-card">
      <Link aria-label={`View showtimes for ${movie.title}`} href={`/movies/${movie.id}`}>
        <MoviePoster className="card-poster" movie={movie} />
        <div className="movie-card-copy">
          <div className="movie-card-title">
            <h3>{movie.title}</h3>
            <span className="rating-tag">{movie.rating}</span>
          </div>
          <p>{movie.genres.join(" · ")} <span aria-hidden="true">·</span> {movie.runtimeMinutes} min</p>
        </div>
      </Link>
    </article>
  );
}
