# Manual browser verification checklist

- [ ] Visit `/` at desktop, tablet, and narrow mobile widths; use search and open a movie.
- [ ] Choose a showtime and verify the show ID is preserved in `/shows/{showId}/seats`.
- [ ] Confirm the seat page opens in the 3D auditorium with Elite rows raised at the back
  and the Lounger section nearest the screen.
- [ ] Drag to orbit, scroll to zoom, and click free seats; ensure dragging never toggles a seat.
- [ ] Select and deselect seats, preview each selected seat, and return to the same overview
  with the existing selection intact.
- [ ] Verify the first-person camera uses each seat's eye height and targets the 71 ft × 37.4 ft
  curved screen from a seated perspective; drag to look through a full 360° horizontally and
  look up/down within the safe pitch limits. Scroll to adjust the field of view. Looking around
  must not select or deselect seats.
- [ ] Use the screen-reader/keyboard seat picker; disable WebGL and finish selection in the 2D fallback.
- [ ] Configure an authorized CORS-enabled trailer source; verify muted autoplay fallback,
  explicit sound control, seeking, error state, and playback continuity while changing seats.
- [ ] Complete the mock reservation journey and confirm UI calls it a mock hold, not a
  paid/confirmed booking. Check refresh behavior on a seat conflict.
- [ ] Run keyboard-only and reduced-motion checks.
