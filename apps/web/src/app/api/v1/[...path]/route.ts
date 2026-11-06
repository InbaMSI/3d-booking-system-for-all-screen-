import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api/types";
import { getCinemaStore } from "@/lib/server/cinema-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const localDemoToken = "local-chennai-demo-token";
const demoUserId = "local-demo-customer";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

interface PageRequest {
  size: number;
  offset: number;
}

function getPageRequest(request: NextRequest): PageRequest {
  const rawSize = request.nextUrl.searchParams.get("pageSize");
  const rawToken = request.nextUrl.searchParams.get("pageToken");
  const size = rawSize === null ? 20 : Number(rawSize);
  const offset = rawToken === null ? 0 : Number(rawToken);
  if (!Number.isInteger(size) || size < 1 || size > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new ApiError("pageSize must be 1–100 and pageToken must be a non-negative offset.", "INVALID_PAGINATION", 400);
  }
  return { size, offset };
}

function pageItems<T>(items: T[], page: PageRequest): { items: T[]; nextPageToken?: string } {
  const pagedItems = items.slice(page.offset, page.offset + page.size);
  return {
    items: pagedItems,
    ...(page.offset + page.size < items.length ? { nextPageToken: String(page.offset + page.size) } : {}),
  };
}

function filterShowsByDate<T extends { startsAt: string }>(
  shows: T[],
  request: NextRequest,
): T[] {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const fromTime = from ? Date.parse(from) : null;
  const toTime = to ? Date.parse(to) : null;
  if ((from && (fromTime === null || !Number.isFinite(fromTime))) || (to && (toTime === null || !Number.isFinite(toTime)))) {
    throw new ApiError("from and to must be valid date-time values.", "INVALID_DATE_FILTER", 400);
  }
  return shows.filter((show) => {
    const time = Date.parse(show.startsAt);
    return (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime);
  });
}

function responseError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { code: error.code, message: error.message, ...(error.seatIds.length ? { seatIds: error.seatIds } : {}) },
      { status: error.status },
    );
  }
  console.error("Cinema API request failed.", error);
  return NextResponse.json(
    { code: "INTERNAL_ERROR", message: "The cinema service could not complete this request." },
    { status: 500 },
  );
}

function requireDemoUser(request: NextRequest): string {
  if (process.env.NODE_ENV !== "development") {
    throw new ApiError("The local demo identity is disabled outside development mode.", "AUTH_NOT_CONFIGURED", 503);
  }
  const expectedToken = process.env.CINEMA_DEMO_BEARER_TOKEN
    ?? (process.env.NODE_ENV === "development" ? localDemoToken : "");
  const receivedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedToken) {
    throw new ApiError("Demo authentication is not configured. Configure a real identity provider before deployment.", "AUTH_NOT_CONFIGURED", 503);
  }
  if (!receivedToken || receivedToken !== expectedToken) {
    throw new ApiError("A valid customer bearer token is required.", "UNAUTHENTICATED", 401);
  }
  return demoUserId;
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError("Request body must be valid JSON.", "INVALID_JSON", 400);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError("Request body must be a JSON object.", "INVALID_BODY", 400);
  }
  return value as Record<string, unknown>;
}

function requireIdempotencyKey(request: NextRequest): string {
  const key = request.headers.get("Idempotency-Key");
  if (!key) throw new ApiError("An Idempotency-Key header is required.", "IDEMPOTENCY_KEY_REQUIRED", 400);
  return key;
}

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { path } = await context.params;
    const parts = path.map((part) => decodeURIComponent(part));
    const method = request.method.toUpperCase();
    const store = getCinemaStore();

    if (method === "GET" && parts.length === 1 && parts[0] === "movies") {
      const query = request.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase() ?? "";
      const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
      const matchingCinemaIds = new Set(store.listCinemas("", city).map((cinema) => cinema.id));
      const items = store.listMovies().filter((movie) => {
        const queryMatches = !query
          || `${movie.title} ${movie.synopsis} ${movie.genres.join(" ")}`.toLocaleLowerCase().includes(query);
        const cityMatches = !city
          || store.listMovieShows(movie.id).some((show) => matchingCinemaIds.has(show.cinemaId));
        return queryMatches && cityMatches;
      });
      return NextResponse.json(pageItems(items, getPageRequest(request)));
    }
    if (method === "GET" && parts.length === 2 && parts[0] === "movies") {
      return NextResponse.json(store.getMovie(parts[1]));
    }
    if (method === "GET" && parts.length === 3 && parts[0] === "movies" && parts[2] === "shows") {
      return NextResponse.json(pageItems(
        filterShowsByDate(store.listMovieShows(parts[1]), request),
        getPageRequest(request),
      ));
    }
    if (method === "GET" && parts.length === 1 && parts[0] === "cinemas") {
      return NextResponse.json(pageItems(
        store.listCinemas(request.nextUrl.searchParams.get("q") ?? "", request.nextUrl.searchParams.get("city") ?? ""),
        getPageRequest(request),
      ));
    }
    if (method === "GET" && parts.length === 2 && parts[0] === "cinemas") {
      return NextResponse.json(store.getCinema(parts[1]));
    }
    if (method === "GET" && parts.length === 3 && parts[0] === "cinemas" && parts[2] === "shows") {
      return NextResponse.json(pageItems(
        filterShowsByDate(store.listCinemaShows(parts[1]), request),
        getPageRequest(request),
      ));
    }
    if (method === "GET" && parts.length === 2 && parts[0] === "shows") {
      return NextResponse.json(store.getShowtime(parts[1]));
    }
    if (method === "GET" && parts.length === 3 && parts[0] === "shows" && parts[2] === "seats") {
      return NextResponse.json(store.getSeatInventory(parts[1]));
    }
    if (method === "POST" && parts.length === 3 && parts[0] === "shows" && parts[2] === "reservations") {
      const userId = requireDemoUser(request);
      const body = await readJson(request);
      if (!Array.isArray(body.seatIds) || body.seatIds.some((seatId) => typeof seatId !== "string")) {
        throw new ApiError("seatIds must be an array of seat ID strings.", "INVALID_SEATS", 400);
      }
      const reservation = store.createReservation(
        parts[1],
        body.seatIds as string[],
        userId,
        requireIdempotencyKey(request),
      );
      return NextResponse.json(reservation, { status: 201 });
    }
    if (method === "GET" && parts.length === 2 && parts[0] === "bookings") {
      const userId = requireDemoUser(request);
      return NextResponse.json(store.getBooking(parts[1], userId));
    }
    if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "payment-orders") {
      const userId = requireDemoUser(request);
      const order = store.createPaymentOrder(parts[1], userId, requireIdempotencyKey(request));
      return NextResponse.json(order, { status: 201 });
    }
    if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "payment-verifications") {
      const userId = requireDemoUser(request);
      const body = await readJson(request);
      if (typeof body.providerPaymentId !== "string" || !body.providerPaymentId) {
        throw new ApiError("providerPaymentId is required.", "INVALID_PAYMENT", 400);
      }
      requireIdempotencyKey(request);
      return NextResponse.json(store.verifyPayment(parts[1], userId));
    }
    if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "cancellation-requests") {
      const userId = requireDemoUser(request);
      const reservation = store.cancelReservation(parts[1], userId, requireIdempotencyKey(request));
      return NextResponse.json(reservation);
    }
    if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "refund-requests") {
      const userId = requireDemoUser(request);
      const body = await readJson(request);
      if (typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 500) {
        throw new ApiError("A refund reason of at most 500 characters is required.", "INVALID_REFUND_REASON", 400);
      }
      requireIdempotencyKey(request);
      return NextResponse.json(store.requestRefund(parts[1], userId), { status: 202 });
    }
    if (method === "GET" && parts.length === 2 && parts[0] === "account" && parts[1] === "bookings") {
      return NextResponse.json({ items: store.listAccountBookings(requireDemoUser(request)) });
    }
    if (method === "GET" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "ticket") {
      const userId = requireDemoUser(request);
      return NextResponse.json(store.getTicket(parts[1], userId));
    }
    if (method === "POST" && parts.length === 3 && parts[0] === "payments" && parts[1] === "webhooks" && parts[2] === "razorpay") {
      throw new ApiError("Razorpay webhooks are unavailable until a verified gateway integration is configured.", "PAYMENT_PROVIDER_NOT_CONFIGURED", 503);
    }
    throw new ApiError("API route not found.", "NOT_FOUND", 404);
  } catch (error) {
    return responseError(error);
  }
}

export const GET = handle;
export const POST = handle;
