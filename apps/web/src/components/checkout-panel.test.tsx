import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleReservation } from "@/lib/api/mock-data";
import { cinemas, movies, shows } from "@/lib/api/mock-data";

const api = vi.hoisted(() => ({
  getBooking: vi.fn(),
  createPaymentOrder: vi.fn(),
  getShowtime: vi.fn(),
  getMovie: vi.fn(),
  getCinema: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  cinemaApi: api,
  usingMockApi: true,
}));

import { CheckoutPanel } from "./checkout-panel";

describe("CheckoutPanel", () => {
  beforeEach(() => {
    api.getBooking.mockResolvedValue(sampleReservation);
    api.getShowtime.mockResolvedValue(shows[0]);
    api.getMovie.mockResolvedValue(movies[0]);
    api.getCinema.mockResolvedValue(cinemas[0]);
    api.createPaymentOrder.mockResolvedValue({
      orderId: "mock-order",
      amountMinor: sampleReservation.amountMinor,
      currency: sampleReservation.currency,
      provider: "mock",
      checkoutUrl: null,
    });
  });

  it("prevents duplicate submissions while the payment order is pending", async () => {
    let resolveOrder: (() => void) | undefined;
    api.createPaymentOrder.mockReturnValue(new Promise<void>((resolve) => { resolveOrder = resolve; }));
    render(<CheckoutPanel bookingId={sampleReservation.id} />);
    const button = await screen.findByRole("button", { name: /create demo payment order/i });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /creating demo order/i })).toBeDisabled();
    expect(api.createPaymentOrder).toHaveBeenCalledTimes(1);
    resolveOrder?.();
    api.getBooking.mockResolvedValue({ ...sampleReservation, paymentStatus: "pending" });
    await waitFor(() => expect(screen.getByRole("button", { name: /retry demo order/i })).toBeInTheDocument());
  });

  it("shows a payment handoff failure and never reports a confirmed booking", async () => {
    api.createPaymentOrder.mockRejectedValue(new Error("Network unavailable"));
    render(<CheckoutPanel bookingId={sampleReservation.id} />);
    fireEvent.click(await screen.findByRole("button", { name: /create demo payment order/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });
});
