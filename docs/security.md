# Security boundary

This frontend is a mock-backed development implementation, not a payment system.
It stores mock reservation snapshots in browser local storage solely to support
the demo navigation. Never use that storage pattern for real holds or payment.

The Phase 3 API must authenticate customers, enforce booking ownership, calculate
all prices and seat availability in PostgreSQL transactions, require
idempotency keys, verify provider webhooks/signatures server-side, and issue
tickets only after an authoritative verified payment outcome. No payment
credentials or provider secrets belong in this application.
