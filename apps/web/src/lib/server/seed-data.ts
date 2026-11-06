import type { Cinema, Movie, Seat, SeatInventory, Showtime } from "@/lib/api/types";
import { movies } from "@/lib/api/mock-data";

interface AuditoriumSeed {
  cinema: Cinema;
  rows: number;
  seatsPerRow: number;
  seatPriceMinor: number;
  screenWidth: number;
  screenHeight: number;
  showSchedule: Array<{ movieId: string; times: string[] }>;
}

const auditoriums: AuditoriumSeed[] = [
  {
    cinema: {
      id: "marina-crown",
      name: "Marina Crown Cinemas",
      address: "Demo venue · Marina Beach, Chennai",
      auditoriumName: "Coral IMAX Hall",
      assetUrl: null,
    },
    rows: 13,
    seatsPerRow: 20,
    seatPriceMinor: 42000,
    screenWidth: 21.6,
    screenHeight: 11.4,
    showSchedule: [
      { movieId: "the-last-orbit", times: ["13:30", "18:30"] },
      { movieId: "afterglow", times: ["16:00", "21:15"] },
      { movieId: "emberline", times: ["11:00"] },
    ],
  },
  {
    cinema: {
      id: "t-nagar-royale",
      name: "T. Nagar Royale Screens",
      address: "Demo venue · Pondy Bazaar, T. Nagar, Chennai",
      auditoriumName: "Royale Grand Auditorium",
      assetUrl: null,
    },
    rows: 11,
    seatsPerRow: 18,
    seatPriceMinor: 36000,
    screenWidth: 18,
    screenHeight: 9.5,
    showSchedule: [
      { movieId: "afterglow", times: ["12:15", "18:45"] },
      { movieId: "emberline", times: ["15:30", "21:00"] },
      { movieId: "the-last-orbit", times: ["20:15"] },
    ],
  },
  {
    cinema: {
      id: "velachery-orbit",
      name: "Velachery Orbit Multiplex",
      address: "Demo venue · Velachery Main Road, Chennai",
      auditoriumName: "Orbit Screen One",
      assetUrl: null,
    },
    rows: 10,
    seatsPerRow: 16,
    seatPriceMinor: 32000,
    screenWidth: 16,
    screenHeight: 8.5,
    showSchedule: [
      { movieId: "emberline", times: ["13:00", "19:30"] },
      { movieId: "the-last-orbit", times: ["16:15", "21:30"] },
      { movieId: "afterglow", times: ["18:00"] },
    ],
  },
  {
    cinema: {
      id: "anna-nagar-silver",
      name: "Anna Nagar Silver Screen",
      address: "Demo venue · 2nd Avenue, Anna Nagar, Chennai",
      auditoriumName: "Silver Screen Auditorium",
      assetUrl: null,
    },
    rows: 9,
    seatsPerRow: 15,
    seatPriceMinor: 28000,
    screenWidth: 15,
    screenHeight: 8,
    showSchedule: [
      { movieId: "the-last-orbit", times: ["14:00", "20:45"] },
      { movieId: "afterglow", times: ["17:00", "21:15"] },
      { movieId: "emberline", times: ["19:00"] },
    ],
  },
  {
    cinema: {
      id: "omr-horizon",
      name: "OMR Horizon Pictures",
      address: "Demo venue · Sholinganallur, Old Mahabalipuram Road, Chennai",
      auditoriumName: "Horizon Atmos Hall",
      assetUrl: null,
    },
    rows: 12,
    seatsPerRow: 19,
    seatPriceMinor: 39000,
    screenWidth: 19,
    screenHeight: 10,
    showSchedule: [
      { movieId: "afterglow", times: ["13:45", "20:30"] },
      { movieId: "the-last-orbit", times: ["17:15", "21:45"] },
      { movieId: "emberline", times: ["18:30"] },
    ],
  },
];

export interface SeedShow {
  show: Showtime;
  inventory: SeatInventory;
}

export interface SeedCatalog {
  movies: Movie[];
  cinemas: Cinema[];
  shows: SeedShow[];
}

function nextDayAt(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(hours, minutes, 0, 0);
  return start.toISOString();
}

function createAuditoriumSeats(seed: AuditoriumSeed): Seat[] {
  const aisleAfter = Math.floor(seed.seatsPerRow / 2);
  const spacing = 0.72;
  const aisleGap = 1.2;
  const totalWidth = seed.seatsPerRow * spacing + aisleGap;
  const frontZ = -2.5;
  const seats: Seat[] = [];

  for (let rowIndex = 0; rowIndex < seed.rows; rowIndex += 1) {
    const row = String.fromCharCode("A".charCodeAt(0) + rowIndex);
    const level = rowIndex * 0.32;
    const z = frontZ + rowIndex * 1.45;
    const category = rowIndex === 0
      ? "lounger"
      : rowIndex >= seed.rows - 3
        ? "elite"
        : "standard";

    for (let index = 0; index < seed.seatsPerRow; index += 1) {
      const number = index + 1;
      const aisleOffset = number > aisleAfter ? aisleGap : 0;
      const id = `seat-${row}-${String(number).padStart(2, "0")}`;
      const booked = (rowIndex + number) % 17 === 0;
      seats.push({
        id,
        row,
        number,
        x: -totalWidth / 2 + (number - 0.5) * spacing + aisleOffset,
        y: level,
        z,
        eyeHeight: category === "lounger" ? 1.05 : 1,
        priceMinor: seed.seatPriceMinor + (category === "elite" ? 8000 : category === "lounger" ? 5000 : 0),
        category,
        availability: booked ? "booked" : "available",
      });
    }
  }
  return seats;
}

export function createSeedCatalog(): SeedCatalog {
  const cinemas = auditoriums.map((auditorium) => auditorium.cinema);
  const shows: SeedShow[] = auditoriums.flatMap((auditorium) => {
    const seats = createAuditoriumSeats(auditorium);
    return auditorium.showSchedule.flatMap(({ movieId, times }) => {
      const movie = movies.find((item) => item.id === movieId);
      if (!movie) throw new Error(`Seed show references unknown movie "${movieId}".`);
      return times.map((time) => {
        const startsAt = nextDayAt(time);
        const id = `show-${movieId}-${auditorium.cinema.id}-${time.replace(":", "")}`;
        const show: Showtime = {
          id,
          movieId,
          cinemaId: auditorium.cinema.id,
          cinemaName: auditorium.cinema.name,
          auditoriumName: auditorium.cinema.auditoriumName,
          startsAt,
          priceFromMinor: auditorium.seatPriceMinor,
          currency: "INR",
        };
        return {
          show,
          inventory: {
            showId: id,
            screen: {
              center: [0, 6, -18],
              width: auditorium.screenWidth,
              height: auditorium.screenHeight,
            },
            seats,
          },
        };
      });
    });
  });
  return { movies, cinemas, shows };
}
