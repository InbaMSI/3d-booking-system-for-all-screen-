# Phase 2 completion criteria

- Routes share navigation and use typed API services.
- The 2D map and WebGL preview share stable seat IDs and selected-seat state.
- Seat preview uses configured geometry and aims at the screen; the 2D fallback
  remains usable without WebGL.
- Mock responses are clearly marked and never represent local selection as a
  confirmed reservation or payment.
- Lint, TypeScript, unit tests, and production build pass; Playwright scenarios
  are provided and run when the browser is installed.
- Remaining backend, payment, authorization, live availability, and media
  authorization limitations are reported.
