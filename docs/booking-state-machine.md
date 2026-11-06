# Booking state machine boundary

Phase 2's client displays server-shaped states but is not authoritative.

- Reservation: `held → confirmed | expired | cancelled`.
- Payment: `not_started → pending → paid | failed`; a failed attempt may be retried
  using a new idempotent payment order while the hold is valid.
- Ticket: not available before backend verification; issued only for a confirmed,
  paid booking.

The browser countdown is informational only. PostgreSQL transactions, reservation
expiry and verified provider notifications decide availability and confirmation.
The mock adapter deliberately leaves payment `pending` after order creation and
never issues tickets for that state.
