"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cinemaApi, usingMockApi } from "@/lib/api/client";
import type { Ticket } from "@/lib/api/types";
import { formatPrice } from "@/lib/domain/seats";
import { getBookingView } from "@/lib/api/booking-view";

export function BookingStatusPanel({ bookingId }: { bookingId: string }) {
  const [view, setView] = useState<Awaited<ReturnType<typeof getBookingView>> | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const current = await getBookingView(bookingId);
      setView(current);
      setTicket(
        current.booking.status === "confirmed" && current.booking.paymentStatus === "paid"
          ? await cinemaApi.getTicket(bookingId)
          : null,
      );
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify booking status.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    let active = true;
    void getBookingView(bookingId).then(
      async (current) => {
        if (!active) return;
        try {
          const issuedTicket = current.booking.status === "confirmed" && current.booking.paymentStatus === "paid"
            ? await cinemaApi.getTicket(bookingId)
            : null;
          if (active) {
            setView(current);
            setTicket(issuedTicket);
          }
        } catch (reason) {
          if (active) setError(reason instanceof Error ? reason.message : "Could not retrieve the verified ticket.");
        }
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not verify booking status.");
      },
    );
    return () => { active = false; };
  }, [bookingId]);

  return (
    <main className="booking-status-page">
      <Link className="back-link" href="/account/bookings"><span aria-hidden="true">←</span> My bookings</Link>
      {usingMockApi && <p className="demo-banner"><strong>DEMO STATUS</strong> This status is from the local mock adapter, not a payment provider.</p>}
      {error && <div className="error-panel" role="alert">{error}<button className="button button-outline" onClick={() => void refresh()} type="button">Try again</button></div>}
      {!view && !error && <div aria-live="polite" className="loading-panel"><span className="loading-ring" />Checking booking status…</div>}
      {view && (
        <section className="ticket-card">
          <div className="ticket-status-icon" aria-hidden="true">{view.booking.status === "confirmed" ? "✓" : view.booking.status === "expired" ? "×" : "…"}</div>
          <p className="eyebrow">BOOKING STATUS · {view.booking.id}</p>
          <h1>{view.booking.status === "confirmed" ? "You’re all set." : view.booking.status === "expired" ? "This hold has expired." : view.booking.status === "cancelled" ? "Reservation cancelled." : "Your seats are on hold."}</h1>
          <p className="ticket-subtitle">
            {view.booking.paymentStatus === "paid"
              ? "Payment was verified by the server."
              : "Payment has not been verified. This is not a confirmed ticket."}
          </p>
          <div className="ticket-details">
            <div><span>FILM</span><strong>{view.movie.title}</strong></div>
            <div><span>SHOWTIME</span><strong>{new Date(view.show.startsAt).toLocaleDateString("en-IN")} · {new Date(view.show.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</strong></div>
            <div><span>SEATS</span><strong>{view.booking.seatIds.join(", ")}</strong></div>
            <div><span>TOTAL</span><strong>{formatPrice(view.booking.amountMinor, view.booking.currency)}</strong></div>
          </div>
          {ticket
            ? <div className="ticket-code"><span>YOUR DIGITAL TICKET · ISSUED {new Date(ticket.issuedAt).toLocaleString("en-IN")}</span><strong>{ticket.id}</strong></div>
            : <Link className="button button-primary" href={`/checkout/${encodeURIComponent(view.booking.id)}`}>Return to secure checkout <span aria-hidden="true">→</span></Link>}
          <button className="button button-outline status-refresh" disabled={loading} onClick={() => void refresh()} type="button">{loading ? "Checking…" : "Refresh verified status"}</button>
        </section>
      )}
    </main>
  );
}
