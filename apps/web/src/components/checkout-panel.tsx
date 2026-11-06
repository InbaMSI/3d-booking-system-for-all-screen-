"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cinemaApi, usingMockApi } from "@/lib/api/client";
import { ApiError, type Cinema, type Movie, type Reservation, type Showtime } from "@/lib/api/types";
import { getBookingView } from "@/lib/api/booking-view";
import { formatPrice } from "@/lib/domain/seats";

export function CheckoutPanel({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<Reservation | null>(null);
  const [show, setShow] = useState<Showtime | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const paymentKey = useRef<string | null>(null);
  const cancellationKey = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const current = await cinemaApi.getBooking(bookingId);
      setBooking(current);
      setRemainingSeconds(Math.max(0, Math.floor((Date.parse(current.expiresAt) - Date.now()) / 1000)));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify reservation status.");
    }
  }, [bookingId]);

  useEffect(() => {
    let active = true;
    void getBookingView(bookingId).then(
      (view) => {
        if (!active) return;
        setBooking(view.booking);
        setShow(view.show);
        setMovie(view.movie);
        setCinema(view.cinema);
        setRemainingSeconds(Math.max(0, Math.floor((Date.parse(view.booking.expiresAt) - Date.now()) / 1000)));
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not verify reservation status.");
      },
    );
    return () => { active = false; };
  }, [bookingId]);

  useEffect(() => {
    if (!booking || booking.status !== "held") return;
    const timer = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.floor((Date.parse(booking.expiresAt) - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [booking]);

  async function startPayment() {
    if (!booking || pending) return;
    setPending(true);
    setError(null);
    const idempotencyKey = paymentKey.current ?? crypto.randomUUID();
    paymentKey.current = idempotencyKey;
    try {
      await cinemaApi.createPaymentOrder(booking.id, idempotencyKey);
      paymentKey.current = null;
      await refreshStatus();
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "HOLD_EXPIRED") {
        await refreshStatus();
      }
      setError(reason instanceof Error ? reason.message : "Payment could not be started.");
    } finally {
      setPending(false);
    }
  }

  async function cancelReservation() {
    if (!booking || cancelling) return;
    setCancelling(true);
    setError(null);
    const idempotencyKey = cancellationKey.current ?? crypto.randomUUID();
    cancellationKey.current = idempotencyKey;
    try {
      const cancelled = await cinemaApi.cancelReservation(booking.id, idempotencyKey);
      cancellationKey.current = null;
      setBooking(cancelled);
      setRemainingSeconds(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The reservation could not be cancelled.");
    } finally {
      setCancelling(false);
    }
  }

  if ((!booking || !show || !movie || !cinema) && !error) {
    return <main className="page-shell"><div aria-live="polite" className="loading-panel"><span className="loading-ring" />Loading your reservation…</div></main>;
  }
  if (!booking || !show || !movie || !cinema) {
    return <main className="page-shell"><div className="error-panel" role="alert">{error}<Link className="button button-outline" href="/">Return to films</Link></div></main>;
  }

  const expired = remainingSeconds <= 0 || booking.status === "expired";
  const cancelled = booking.status === "cancelled";
  const paymentPending = booking.paymentStatus === "pending";
  return (
    <main className="checkout-page">
      <Link className="back-link" href={`/shows/${encodeURIComponent(booking.showId)}/seats`}><span aria-hidden="true">←</span> Back to seats</Link>
      <section className="checkout-heading">
        <p className="eyebrow">ONE LAST THING</p>
        <h1>Review your <em>night.</em></h1>
        <p>Your seats are held only while the reservation timer is active.</p>
      </section>
      <p className="demo-banner">
        <strong>{usingMockApi ? "DEMO · MOCK API" : "DEMO · LOCAL SQLITE BACKEND"}</strong>
        {usingMockApi
          ? " This is a simulated reservation and payment handoff. No charge will be made."
          : " The reservation is stored locally. Payment is not connected, no charge will be made, and this cannot confirm a ticket."}
      </p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="checkout-grid">
        <section className="checkout-card">
          <div className="checkout-card-title"><span>YOUR RESERVATION</span><span className={`reservation-status ${expired || cancelled ? "expired" : ""}`}>{cancelled ? "CANCELLED" : expired ? "EXPIRED" : booking.status.toUpperCase()}</span></div>
          <h2>{movie.title}</h2>
          <p>{cinema.name} · {show.auditoriumName}</p>
          <p>{new Date(show.startsAt).toLocaleDateString("en-IN")} · {new Date(show.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
          <div className="checkout-seats">
            <span>Seats</span><strong>{booking.seatIds.join(", ")}</strong>
          </div>
          <div className="checkout-price"><span>Total <small>Server-calculated</small></span><strong>{formatPrice(booking.amountMinor, booking.currency)}</strong></div>
        </section>
        <aside className="payment-card">
          <p className="eyebrow">PAYMENT · NOT CONNECTED</p>
          <div className="expiry-clock"><span aria-hidden="true">◷</span><span><strong>{expired ? "Hold expired" : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`}</strong><small>Reservation time remaining</small></span></div>
          <div className="payment-status"><span>Payment status</span><strong>{booking.paymentStatus === "not_started" ? "Not started" : booking.paymentStatus === "pending" ? "Awaiting verification" : booking.paymentStatus}</strong></div>
          <button className="button button-primary reserve-button" disabled={pending || expired || cancelled || booking.status !== "held"} onClick={() => void startPayment()} type="button">
            {pending ? "Creating demo order…" : paymentPending ? "Retry demo order" : "Create demo payment order"} <span aria-hidden="true">→</span>
          </button>
          {paymentPending && <button className="button button-outline reserve-button" disabled={pending} onClick={() => void refreshStatus()} type="button">Check payment status</button>}
          {paymentPending && <Link className="text-link status-link" href={`/bookings/${encodeURIComponent(booking.id)}`}>View booking status <span aria-hidden="true">→</span></Link>}
          <p className="summary-note">A redirect or browser callback cannot confirm payment. Booking status is verified by the server.</p>
          {booking.status === "held" && !expired && <button className="text-link cancel-reservation" disabled={cancelling} onClick={() => void cancelReservation()} type="button">{cancelling ? "Cancelling reservation…" : "Cancel reservation"}</button>}
          {cancelled && <Link className="text-link payment-cancel" href="/">Return to films <span aria-hidden="true">→</span></Link>}
        </aside>
      </div>
      <p className="ticket-note">Your booking is not confirmed until the payment provider verifies the transaction. A digital ticket will appear on the booking status page only after backend confirmation.</p>
    </main>
  );
}
