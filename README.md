# Reel. cinema booking frontend

Cinema booking prototype with a Next.js App Router frontend and versioned API
contract at `docs/openapi/cinema-v1.yaml`. The local backend is implemented as
Next.js API route handlers backed by SQLite. It seeds five fictional Chennai
cinemas, distinct show schedules, and individual auditorium seat layouts.
Reservations persist locally and allocate seats transactionally; payment remains
an explicitly unconnected demo handoff.

## Run locally

Requirements: Node.js 22.15+ and npm 10.5.1+. From the workspace root:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. The development server starts the frontend and API
together; the browser calls same-origin `/api/v1` routes. SQLite is created
automatically at `apps/web/data/cinema.sqlite` and is ignored by Git. To
customize the local setup, copy `apps/web/.env.example` to
`apps/web/.env.local` and restart Next.js.

The local demo bearer token is intentionally available to the browser and only
accepted in development mode. It is not customer authentication. Do not deploy
this backend: production requires a real identity provider, a production database
with deployment-safe migrations, rate limiting, operational monitoring, and a
verified payment provider/webhook integration.

## Quality checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e
```

Regenerate API schema types after changing the contract with `npm run api:types`.
Playwright may require `npx playwright install chromium` in a fresh environment.

## Routes

- `/` discovery, film and cinema search
- `/movies/{movieId}` film details and showtimes
- `/cinemas` browse the five seeded Chennai venues
- `/cinemas/{cinemaId}` venue/auditorium information
- `/shows/{showId}/seats` shared 2D and procedural 3D selection
- `/checkout/{bookingId}` persistent reservation and explicitly mock payment handoff
- `/bookings/{bookingId}` server-status booking view
- `/account/bookings` local demo booking history
- `/admin` scoped, non-operational admin shell

The backend supports movie/cinema/show discovery, show-specific seats,
five-minute idempotent reservation holds, conflict detection, booking ownership
within the single local demo identity, cancellation, and account history.
Payment orders only transition to `pending`; client-supplied payment IDs never
confirm a booking and tickets remain unavailable. Refunds and Razorpay webhooks
return explicit not-configured errors.

Read `docs/manual-browser-checklist.md` before accepting the camera, trailer,
reduced-motion, or mobile behavior. The auditorium is explicitly labeled a
procedural prototype; no production GLB model or authorized trailers were
provided.
