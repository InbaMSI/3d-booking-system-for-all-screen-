# Cinema API contract and local implementation

`../openapi/cinema-v1.yaml` is the shared contract. A local development
implementation is available through Next.js route handlers and SQLite.
Monetary values are integer minor units with an ISO 4217 currency. The server
owns availability, prices, reservation expiry, and current payment state.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/movies` | Discover currently listed movies |
| GET | `/api/v1/movies/{movieId}` | Movie details |
| GET | `/api/v1/movies/{movieId}/shows` | Movie showtimes |
| GET | `/api/v1/cinemas?q={query}` | Search cinemas by name/address |
| GET | `/api/v1/cinemas/{cinemaId}` | Cinema and auditorium metadata |
| GET | `/api/v1/cinemas/{cinemaId}/shows` | Cinema showtimes |
| GET | `/api/v1/shows/{showId}` | Showtime details |
| GET | `/api/v1/shows/{showId}/seats` | Show-specific seat inventory |
| POST | `/api/v1/shows/{showId}/reservations` | Atomically request a temporary seat hold; requires `Idempotency-Key` |
| GET | `/api/v1/bookings/{bookingId}` | Authoritative reservation/booking status |
| POST | `/api/v1/bookings/{bookingId}/payment-orders` | Create/retrieve a server-priced payment order |
| POST | `/api/v1/bookings/{bookingId}/payment-verifications` | Verify a public provider payment ID server-side |
| POST | `/api/v1/bookings/{bookingId}/cancellation-requests` | Ask the server to cancel an eligible hold/booking |
| POST | `/api/v1/bookings/{bookingId}/refund-requests` | Ask the server to evaluate its refund policy |
| POST | `/api/v1/payments/webhooks/razorpay` | Verify signed, idempotent Razorpay webhook events |
| GET | `/api/v1/account/bookings` | Authenticated customer's booking history |
| GET | `/api/v1/bookings/{bookingId}/ticket` | Ticket after authoritative confirmation |

Reservation conflicts return `409` with `code: SEAT_UNAVAILABLE` and affected
seat IDs. A successful reservation returns the server booking ID, held seat IDs,
server-calculated amount/currency, and expiration timestamp. Payment order
creation does not confirm a booking. The client must query booking status after
the provider handoff; only a verified backend payment event can confirm it.

Reservation, payment-order, payment-verification, cancellation, and refund
requests require customer authentication and an `Idempotency-Key`. Retrying the
same operation with the same key returns the original result. Booking and ticket
reads require ownership authorization. The Razorpay webhook uses
`X-Razorpay-Signature` and the raw body; it must not use customer bearer auth.
All list responses use an `items` array and may expose `nextPageToken` when
pagination is enabled by the backend.

Seat `category` values are `standard`, `elite`, or `lounger`; seat coordinates
(`x`, `y`, `z`) are auditorium positions in meters and `eyeHeight` is the
camera height above that seat's row platform. The mock auditorium uses a
71 ft × 37.4 ft screen (about 21.6 m × 11.4 m, or 1.89:1).

## Local development implementation

The seed catalog contains five fictional Chennai demo cinemas, multiple
different movie/showtime combinations, and cinema-specific seat counts,
categories, geometry, prices, and screen dimensions. Data is persisted in
`apps/web/data/cinema.sqlite`; the file is ignored by Git. The database is
initialized and seeded when the local API starts.

In development, the API exposes the discovery, showtime, seat inventory,
reservation, booking, cancellation, payment-order, account-history, and ticket
paths above. Seat holds use SQLite write transactions and idempotency records.
Expired holds are released on inventory and booking reads.

The browser demo uses a fixed bearer token only in development, mapped to one
local demo identity. It is intentionally not a login system and is disabled
outside development. Payment order creation returns provider `mock` with no
checkout URL and leaves payment `pending`; payment verification, refunds,
Razorpay webhooks, and ticket issuance are not configured. A client-provided
payment ID cannot confirm a reservation.

This SQLite prototype is for local review only. Before deployment, replace the
demo identity with real authentication/ownership, use a deployment-safe
production datastore and migrations, and implement provider-side payment
verification and signed webhooks. Do not enable the development bearer in
production.
