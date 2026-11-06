import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type CinemaDatabase = InstanceType<typeof Database>;

const globalForCinemaDb = globalThis as typeof globalThis & {
  cinemaDatabase?: CinemaDatabase;
};

function databasePath(): string {
  return process.env.CINEMA_DATABASE_PATH
    ? path.resolve(process.env.CINEMA_DATABASE_PATH)
    : path.join(process.cwd(), "data", "cinema.sqlite");
}

export function getDatabase(): CinemaDatabase {
  if (globalForCinemaDb.cinemaDatabase) return globalForCinemaDb.cinemaDatabase;

  const filePath = databasePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  initializeDatabase(database);
  globalForCinemaDb.cinemaDatabase = database;
  return database;
}

export function initializeDatabase(database: CinemaDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cinemas (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shows (
      id TEXT PRIMARY KEY,
      movie_id TEXT NOT NULL REFERENCES movies(id),
      cinema_id TEXT NOT NULL REFERENCES cinemas(id),
      starts_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS shows_movie_start ON shows(movie_id, starts_at);
    CREATE INDEX IF NOT EXISTS shows_cinema_start ON shows(cinema_id, starts_at);
    CREATE TABLE IF NOT EXISTS show_inventories (
      show_id TEXT PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
      screen_payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seats (
      show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      row_label TEXT NOT NULL,
      number INTEGER NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      eye_height REAL NOT NULL,
      price_minor INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('standard', 'elite', 'lounger')),
      initial_availability TEXT NOT NULL CHECK(initial_availability IN ('available', 'booked')),
      PRIMARY KEY(show_id, id)
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL REFERENCES shows(id),
      user_id TEXT NOT NULL,
      seat_ids TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('held', 'expired', 'confirmed', 'cancelled')),
      payment_status TEXT NOT NULL CHECK(payment_status IN ('not_started', 'pending', 'failed', 'paid')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reservations_owner_created ON reservations(user_id, created_at);
    CREATE TABLE IF NOT EXISTS reserved_seats (
      show_id TEXT NOT NULL,
      seat_id TEXT NOT NULL,
      reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
      PRIMARY KEY(show_id, seat_id),
      FOREIGN KEY(show_id, seat_id) REFERENCES seats(show_id, id)
    );
    CREATE INDEX IF NOT EXISTS reserved_seats_reservation ON reserved_seats(reservation_id);
    CREATE TABLE IF NOT EXISTS idempotency_records (
      user_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      response_payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(user_id, operation, idempotency_key)
    );
  `);
  migrateReservedSeats(database);
}

function migrateReservedSeats(database: CinemaDatabase): void {
  const indexes = database.prepare("PRAGMA index_list('reserved_seats')").all() as Array<{ unique: number; origin: string }>;
  if (!indexes.some((index) => index.unique === 1 && index.origin === "u")) return;
  const migrate = database.transaction(() => {
    database.exec(`
      DROP INDEX IF EXISTS reserved_seats_reservation;
      ALTER TABLE reserved_seats RENAME TO reserved_seats_legacy;
      CREATE TABLE reserved_seats (
        show_id TEXT NOT NULL,
        seat_id TEXT NOT NULL,
        reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        PRIMARY KEY(show_id, seat_id),
        FOREIGN KEY(show_id, seat_id) REFERENCES seats(show_id, id)
      );
      INSERT INTO reserved_seats (show_id, seat_id, reservation_id)
        SELECT show_id, seat_id, reservation_id FROM reserved_seats_legacy;
      DROP TABLE reserved_seats_legacy;
      CREATE INDEX reserved_seats_reservation ON reserved_seats(reservation_id);
    `);
  });
  migrate();
}
