import type { Cinema, Movie, Reservation, Seat, SeatInventory, Showtime } from "./types";

export const movies: Movie[] = [
  {
    id: "the-last-orbit",
    title: "The Last Orbit",
    synopsis:
      "With the last signal fading beyond Neptune, one astronaut must decide what is worth bringing home.",
    runtimeMinutes: 128,
    rating: "UA 13+",
    genres: ["Sci-fi", "Adventure"],
    posterTone: "orbit",
    trailerUrl: null,
  },
  {
    id: "afterglow",
    title: "Afterglow",
    synopsis:
      "Two strangers meet on the final train of the night and discover the city has a story for both of them.",
    runtimeMinutes: 112,
    rating: "U",
    genres: ["Drama", "Romance"],
    posterTone: "afterglow",
    trailerUrl: null,
  },
  {
    id: "emberline",
    title: "Emberline",
    synopsis:
      "A quiet mountain town comes together to rebuild after a summer wildfire changes everything.",
    runtimeMinutes: 104,
    rating: "UA 7+",
    genres: ["Drama"],
    posterTone: "emberline",
    trailerUrl: null,
  },
];

export const cinemas: Cinema[] = [
  {
    id: "grand-arcade",
    name: "Grand Arcade Cinema",
    address: "12 Phoenix Market Road, Bengaluru",
    auditoriumName: "The Grand Hall",
    assetUrl: null,
  },
];

const startAt = (hour: number, minute: number) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const shows: Showtime[] = movies.flatMap((movie, movieIndex) => [
  {
    id: `show-${movie.id}-1830`,
    movieId: movie.id,
    cinemaId: "grand-arcade",
    cinemaName: "Grand Arcade Cinema",
    auditoriumName: "The Grand Hall",
    startsAt: startAt(18, 30 + movieIndex * 10),
    priceFromMinor: 41000,
    currency: "INR",
  },
  {
    id: `show-${movie.id}-2115`,
    movieId: movie.id,
    cinemaId: "grand-arcade",
    cinemaName: "Grand Arcade Cinema",
    auditoriumName: "The Grand Hall",
    startsAt: startAt(21, 15 + movieIndex * 10),
    priceFromMinor: 41000,
    currency: "INR",
  },
]);

export function createMockSeats(): Seat[] {
  const rows = [
    { row: "A", count: 35, aisles: [], z: 19.9, level: 3.92, category: "elite" },
    ...["B", "C", "D", "E", "F", "G", "H", "I"].map((row, index) => ({
      row,
      count: 22,
      aisles: [3, 19],
      z: 18.3 - index * 1.6,
      level: 3.64 - index * 0.28,
      category: "elite" as const,
    })),
    ...["J", "K", "L", "M", "N"].map((row, index) => ({
      row,
      count: 28,
      aisles: [6, 22],
      z: 5.5 - index * 1.6,
      level: 1.4 - index * 0.28,
      category: "elite" as const,
    })),
    { row: "O", count: 24, aisles: [5, 19], z: -2.5, level: 0, category: "lounger" },
  ] as const;

  return rows.flatMap(({ row, count, aisles, z, level, category }) => {
    const aisleWidth = 1.2;
    const seatSpacing = 0.64;
    const rowWidth = count * seatSpacing + aisles.length * aisleWidth;
    return Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      const aisleOffset = aisles.filter((after) => number > after).length * aisleWidth;
      const id = `seat-${row}-${String(number).padStart(2, "0")}`;
      const availability =
        row === "A" && number >= 13 && number <= 21
          ? "booked"
          : row === "B" && number >= 10 && number <= 12
            ? "booked"
            : row === "I" && (number === 4 || number === 5 || (number >= 10 && number <= 14))
              ? "booked"
              : row === "C" && number === 11
                ? "held"
                : row === "C" && number === 12
                  ? "booked"
                  : "available";
      return {
        id,
        row,
        number,
        x: -rowWidth / 2 + (number - 0.5) * seatSpacing + aisleOffset,
        y: level,
        z,
        eyeHeight: category === "lounger" ? 1.05 : 1,
        priceMinor: 41000,
        category,
        availability,
      } satisfies Seat;
    });
  });
}

export const mockSeatInventory: SeatInventory = {
  showId: shows[0].id,
  screen: { center: [0, 6, -18], width: 21.6, height: 11.4 },
  seats: createMockSeats(),
};

export const sampleReservation: Reservation = {
  id: "demo-reservation",
  showId: shows[0].id,
  seatIds: ["seat-B-08", "seat-B-09"],
  amountMinor: 370000,
  currency: "INR",
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  status: "held",
  paymentStatus: "not_started",
};
