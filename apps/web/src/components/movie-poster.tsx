import type { Movie } from "@/lib/api/types";

const artwork: Record<string, { eyebrow: string; title: string; motif: string }> = {
  orbit: { eyebrow: "A film by Mira Sen", title: "THE LAST\nORBIT", motif: "orbit-art" },
  afterglow: { eyebrow: "Some nights stay with you", title: "AFTER\nGLOW", motif: "afterglow-art" },
  emberline: { eyebrow: "A story from the mountains", title: "EMBER\nLINE", motif: "ember-art" },
};

export function MoviePoster({ movie, className = "" }: { movie: Movie; className?: string }) {
  const poster = artwork[movie.posterTone] ?? artwork.orbit;
  return (
    <div aria-label={`${movie.title} poster artwork`} className={`movie-poster ${poster.motif} ${className}`} role="img">
      <span className="poster-eyebrow">{poster.eyebrow}</span>
      <span className="poster-title">{poster.title.split("\n").map((line) => <span key={line}>{line}</span>)}</span>
      <span aria-hidden="true" className="poster-orb" />
      <span className="poster-credit">A REEL PICTURE</span>
    </div>
  );
}
