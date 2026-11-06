# Frontend testing strategy

- `npm test`: Vitest and React Testing Library for selection, shared seat IDs,
  price math, camera pose, mock API conflicts, trailer controls, and checkout
  pending/failure behavior.
- `npm run e2e`: Playwright Chromium customer journey and mobile fallback using
  the local mock adapter.
- `npm run typecheck`, `npm run lint`, and `npm run build`: application gates.
- `npm run api:types`: generate TypeScript schemas from
  `docs/openapi/cinema-v1.yaml`.

WebGL rendering itself requires a browser/GPU. Camera math and seat state are
unit-tested; follow `manual-browser-checklist.md` for real-browser verification.
