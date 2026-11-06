"use client";

import { useEffect, useMemo, useState } from "react";
import { MovieCard } from "@/components/movie-card";
import type { Movie } from "@/lib/api/types";
import { cinemaApi } from "@/lib/api/client";
import type { Cinema } from "@/lib/api/types";

type CinemaSearchResult =
  | { query: string; items: Cinema[] }
  | { query: string; error: string };

export function DiscoverySearch({ movies }: { movies: Movie[] }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Chennai");
  const [cinemaSearch, setCinemaSearch] = useState<CinemaSearchResult | null>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const results = useMemo(
    () => movies.filter((movie) =>
      `${movie.title} ${movie.synopsis} ${movie.genres.join(" ")}`.toLocaleLowerCase().includes(normalized),
    ),
    [movies, normalized],
  );
  useEffect(() => {
    if (!normalized) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void cinemaApi.listCinemas(query).then(
        (items) => {
          if (active) setCinemaSearch({ query: normalized, items });
        },
        (reason: unknown) => {
          if (active) setCinemaSearch({ query: normalized, error: reason instanceof Error ? reason.message : "Cinema search failed." });
        },
      );
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalized, query]);

  return (
    <>
      <div className="discovery-search">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search movies or cinemas</span>
          <input onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search films or cinemas" type="search" value={query} />
        </label>
        <label className="location-select">
          <span>SHOWING IN</span>
          <select aria-label="Choose your location" onChange={(event) => setLocation(event.currentTarget.value)} value={location}>
            <option value="Chennai">Chennai</option>
          </select>
        </label>
      </div>
      {normalized && cinemaSearch?.query === normalized && "error" in cinemaSearch && <p className="search-error" role="alert">{cinemaSearch.error}</p>}
      {normalized && cinemaSearch?.query === normalized && "items" in cinemaSearch && cinemaSearch.items.length > 0 && (
        <div className="cinema-search-result">
          {cinemaSearch.items.map((cinema) => (
            <a href={`/cinemas/${cinema.id}`} key={cinema.id}>
              <span><strong>{cinema.name}</strong><small>{cinema.address}</small></span><b aria-hidden="true">↗</b>
            </a>
          ))}
        </div>
      )}
      {!results.length ? (
        <p className="empty-search">No films found in {location}. Try another title or genre.</p>
      ) : (
        <div className="movie-grid">
          {results.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      )}
    </>
  );
}
