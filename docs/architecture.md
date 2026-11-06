# Architecture

Initial monorepo layout follows the Phase 1 modular-monolith plan. `apps/web`
contains a Next.js App Router frontend. `docs/openapi/cinema-v1.yaml` is the
API contract source of truth; `apps/web/src/lib/api` contains generated
contract types and a replaceable service adapter.

Server Components render discovery and static detail pages. Small Client
Components handle search, booking actions, seat state, video controls and
WebGL. Auditorium geometry is data-driven and separate from seat inventory and
reservation logic. The 2D seat map is a first-class booking path.

In development, `NEXT_PUBLIC_API_MODE=http` selects same-origin Next.js API
routes backed by a local SQLite database. `NEXT_PUBLIC_API_MODE=mock` keeps the
original browser mock available. The SQLite prototype supports five seeded
Chennai venues, distinct show/seat inventories, transactional holds and
idempotency, but its fixed development bearer is not real customer
authentication. Payment orders remain pending; only a future verified provider
callback may confirm a booking or issue a ticket.

The local SQLite backend is not the production architecture. Deployment still
requires the planned authenticated service and production database, plus secure
payment-provider verification. The local development token must never be
enabled in production.
