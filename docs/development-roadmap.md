# Development roadmap

1. Phase 1 bootstrap: document architecture, API payloads, and booking invariants.
2. Phase 2: deliver the mock-backed Next.js discovery, venue, seat selection,
   checkout, booking status, and admin shell; stop for review.
3. Phase 3: implement the agreed Django/PostgreSQL contract, authentication,
   transactional seat holds, expiry/recovery, payment verification/webhooks,
   ticket issuance, and permissioned admin endpoints.
4. Integration gate: replace mock mode only after OpenAPI validation and
   PostgreSQL-backed concurrency/payment tests pass.

Do not treat the Phase 2 UI or local browser storage as a production booking
system. See `api-contracts.md` for the endpoints and response fields required
from Phase 3.
