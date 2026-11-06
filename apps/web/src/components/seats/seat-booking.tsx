"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { cinemaApi, usingMockApi } from "@/lib/api/client";
import { ApiError, type Movie, type SeatInventory, type Showtime } from "@/lib/api/types";
import { calculateSeatTotal, formatPrice, updateSeatSelection } from "@/lib/domain/seats";
import { AuditoriumCanvas } from "./auditorium-canvas";

interface SelectionState {
  seatIds: string[];
  previewSeatId: string | null;
}

type SelectionAction =
  | { type: "toggle"; seatId: string }
  | { type: "remove"; seatId: string }
  | { type: "removeMany"; seatIds: string[] }
  | { type: "preview"; seatId: string | null };

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  if (action.type === "preview") return { ...state, previewSeatId: action.seatId };
  if (action.type === "toggle") {
    const seatIds = updateSeatSelection(state.seatIds, { type: "toggle", seatId: action.seatId });
    return {
      seatIds,
      previewSeatId: seatIds.includes(action.seatId) ? action.seatId : (seatIds.at(-1) ?? null),
    };
  }
  const seatIds = action.type === "remove"
    ? updateSeatSelection(state.seatIds, { type: "remove", seatId: action.seatId })
    : state.seatIds.filter((seatId) => !action.seatIds.includes(seatId));
  const removedPreview = action.type === "remove"
    ? state.previewSeatId === action.seatId
    : action.seatIds.includes(state.previewSeatId ?? "");
  return { seatIds, previewSeatId: removedPreview ? (seatIds.at(-1) ?? null) : state.previewSeatId };
}

export function SeatBooking({ show, movie }: { show: Showtime; movie: Movie }) {
  const router = useRouter();
  const [inventory, setInventory] = useState<SeatInventory | null>(null);
  const [selection, dispatchSelection] = useReducer(selectionReducer, { seatIds: [], previewSeatId: null });
  const { seatIds: selectedIds, previewSeatId } = selection;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reservationKey = useRef<string | null>(null);
  const total = useMemo(
    () => calculateSeatTotal(inventory?.seats ?? [], selectedIds),
    [inventory, selectedIds],
  );

  const refreshInventory = useCallback(async () => {
    setLoading(true);
    try {
      setInventory(await cinemaApi.getSeatInventory(show.id));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load seat availability.");
    } finally {
      setLoading(false);
    }
  }, [show.id]);

  useEffect(() => {
    let active = true;
    void cinemaApi.getSeatInventory(show.id).then(
      (data) => {
        if (!active) return;
        setInventory(data);
        setError(null);
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load seat availability.");
      },
    ).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [show.id]);

  const toggleSeat = useCallback((seatId: string) => {
    reservationKey.current = null;
    dispatchSelection({ type: "toggle", seatId });
  }, []);

  const removeSeat = useCallback((seatId: string) => {
    reservationKey.current = null;
    dispatchSelection({ type: "remove", seatId });
  }, []);

  async function reserveSeats() {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    const idempotencyKey = reservationKey.current ?? crypto.randomUUID();
    reservationKey.current = idempotencyKey;
    try {
      const reservation = await cinemaApi.createReservation(show.id, selectedIds, idempotencyKey);
      router.push(`/checkout/${encodeURIComponent(reservation.id)}`);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        reservationKey.current = null;
        await refreshInventory();
        const conflictList = reason.seatIds.length > 0 ? ` (${reason.seatIds.join(", ")})` : "";
        setError(`Those seats were just taken${conflictList}. Availability has been refreshed; please review your selection.`);
        dispatchSelection({ type: "removeMany", seatIds: reason.seatIds });
      } else {
        setError(reason instanceof Error ? reason.message : "Reservation failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="page-shell"><div aria-live="polite" className="loading-panel"><span className="loading-ring" />Loading live seat availability…</div></main>;
  }
  if (!inventory) {
    return <main className="page-shell"><div className="error-panel" role="alert">{error ?? "Seat availability could not be loaded."}<button className="button button-outline" onClick={() => void refreshInventory()} type="button">Try again</button></div></main>;
  }

  const selectedSeats = inventory.seats.filter((seat) => selectedIds.includes(seat.id));
  const previewSeat = inventory.seats.find((seat) => seat.id === previewSeatId) ?? null;
  return (
    <main className="seat-page">
      <div className="seat-page-heading">
        <div>
          <Link className="back-link" href="/"><span aria-hidden="true">←</span> All films</Link>
          <p className="eyebrow">{show.cinemaName} · {new Date(show.startsAt).toLocaleDateString("en-IN")}</p>
          <h1>Find your <em>view.</em></h1>
          <p className="seat-subtitle">Choose a seat for {movie.title}, then preview the view. Elite rises at the rear; Lounger sits nearest the screen.</p>
        </div>
        <span className="demo-badge">{usingMockApi ? "DEMO DATA" : "DEMO · SEEDED DATA"}</span>
      </div>

      <div className="seat-workspace">
        <section className="seat-selection-panel">
          <div className="seat-3d-layout">
            <AuditoriumCanvas
              inventory={inventory}
              onToggleSeat={toggleSeat}
              previewSeatId={previewSeatId}
              selectedIds={selectedIds}
              trailerUrl={movie.trailerUrl}
            />
            <div className="preview-controls">
              <span className="preview-label">PREVIEW A SEAT</span>
              <button className="overview-button" onClick={() => dispatchSelection({ type: "preview", seatId: null })} type="button">Return to auditorium overview</button>
              <div className="preview-seat-list">
                {selectedSeats.length ? selectedSeats.map((seat) => (
                  <button
                    aria-label={`Preview seat ${seat.row}${seat.number}`}
                    aria-pressed={previewSeatId === seat.id}
                    className={previewSeatId === seat.id ? "preview-seat active" : "preview-seat"}
                    key={seat.id}
                    onClick={() => dispatchSelection({ type: "preview", seatId: seat.id })}
                    type="button"
                  >{seat.row}{seat.number}</button>
                )) : <span className="hint-text">Click an available 3D seat to select and preview it.</span>}
              </div>
              <label className="sr-only" htmlFor="accessible-seat-picker">Choose an available seat by row and number</label>
              <select
                className="sr-only"
                id="accessible-seat-picker"
                onChange={(event) => {
                  if (event.currentTarget.value) toggleSeat(event.currentTarget.value);
                }}
                value=""
              >
                <option disabled value="">Choose an available seat</option>
                {inventory.seats.filter((seat) => seat.availability === "available").map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.category === "lounger" ? "Lounger" : "Elite"} · Row {seat.row}, seat {seat.number} · {formatPrice(seat.priceMinor)}
                  </option>
                ))}
              </select>
              {previewSeat && <p aria-live="polite" className="preview-caption">Your view from <strong>Row {previewSeat.row}, seat {previewSeat.number}</strong> · aimed at the screen</p>}
            </div>
          </div>
          {error && <p aria-live="assertive" className="inline-error" role="alert">{error}</p>}
        </section>

        <aside aria-label="Your seat selection" className="booking-summary">
          <div className="summary-topline"><span>YOUR SEATS</span><span>{selectedIds.length} selected</span></div>
          <h2>{selectedIds.length ? "Looking good." : "Take your pick."}</h2>
          {selectedSeats.length ? (
            <ul className="selected-seat-list">
              {selectedSeats.map((seat) => (
                <li key={seat.id}>
                  <span><strong>{seat.row}{seat.number}</strong><small>{seat.category === "elite" ? "Elite" : seat.category === "lounger" ? "Lounger" : "Standard"}</small></span>
                  <span>{formatPrice(seat.priceMinor)}<button aria-label={`Remove seat ${seat.row}${seat.number}`} className="remove-seat" onClick={() => removeSeat(seat.id)} type="button">×</button></span>
                </li>
              ))}
            </ul>
          ) : <p className="empty-selection">Your seats will show up here. Pick one or a few.</p>}
          <div className="summary-total"><span>Subtotal <small>· server confirms final price</small></span><strong>{formatPrice(total)}</strong></div>
          <button className="button button-primary reserve-button" disabled={!selectedIds.length || submitting} onClick={() => void reserveSeats()} type="button">
            {submitting ? "Requesting hold…" : "Continue to checkout"} <span aria-hidden="true">→</span>
          </button>
          <p className="summary-note">Seats are not held until the reservation service confirms your request.</p>
          <div className="show-summary"><span className="show-summary-icon">◷</span><span><strong>{show.cinemaName} · {show.auditoriumName}</strong><small>{new Date(show.startsAt).toLocaleDateString("en-IN")} · {new Date(show.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {movie.title}</small></span></div>
        </aside>
      </div>
    </main>
  );
}
