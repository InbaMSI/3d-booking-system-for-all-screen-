import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockSeats } from "@/lib/api/mock-data";
import { SeatMap2D } from "./seat-map-2d";

describe("SeatMap2D", () => {
  it("announces seat state and sends the stable seat ID to shared selection state", () => {
    const onToggle = vi.fn();
    render(<SeatMap2D onToggle={onToggle} seats={createMockSeats()} selectedIds={[]} />);
    const seat = screen.getByRole("checkbox", { name: /Row A, seat 1, available, elite/i });
    expect(seat).toHaveAttribute("aria-checked", "false");
    fireEvent.click(seat);
    expect(onToggle).toHaveBeenCalledWith("seat-A-01");
  });

  it("marks the same selected ID in the map and never makes held or booked seats selectable", () => {
    render(<SeatMap2D onToggle={vi.fn()} seats={createMockSeats()} selectedIds={["seat-A-01"]} />);
    expect(screen.getByRole("checkbox", { name: /Row A, seat 1, selected/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: /Row B, seat 10, booked/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Row C, seat 11, held/i })).toBeDisabled();
  });
});
