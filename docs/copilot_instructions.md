# Permanent engineering instructions

- Inspect the relevant implementation, API contract, callers, and tests before
  making changes. Preserve unrelated work.
- Keep server-rendered pages, client interactivity, 3D rendering, API state, and
  booking/payment authority in separate modules.
- Use strict TypeScript and contract-generated types; do not use `any`.
- Never trust browser prices, seat availability, reservation status, or payment
  callbacks. The backend must enforce authorization, locking, idempotency, and
  verified payment transitions.
- Add tests for changed behavior. Run lint, type-check, unit tests, production
  build, and feasible end-to-end checks; report what did not run.
- Do not suppress lint rules, fabricate production API behavior, or describe
  mock flows as production-ready. Update the contract and docs with changes.
