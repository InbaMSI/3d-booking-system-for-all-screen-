import { describe, expect, it } from "vitest";
import { createMockSeats, mockSeatInventory } from "@/lib/api/mock-data";
import { calculateSeatTotal, getLookAngles, getLookDirection, getSeatCameraPose, updateSeatSelection } from "./seats";

describe("seat selection domain", () => {
  it("selects and deselects stable seat IDs", () => {
    expect(updateSeatSelection([], { type: "toggle", seatId: "seat-A-01" })).toEqual(["seat-A-01"]);
    expect(updateSeatSelection(["seat-A-01"], { type: "toggle", seatId: "seat-A-01" })).toEqual([]);
    expect(updateSeatSelection(["seat-A-01", "seat-A-02"], { type: "remove", seatId: "seat-A-01" })).toEqual(["seat-A-02"]);
  });

  it("calculates a sum from authoritative inventory prices for selected IDs", () => {
    const seats = createMockSeats();
    expect(calculateSeatTotal(seats, ["seat-A-01", "seat-C-02"])).toBe(82000);
    expect(calculateSeatTotal(seats, ["seat-does-not-exist"])).toBe(0);
  });

  it("positions the preview camera at the selected seat eye height and targets the actual screen", () => {
    const seat = createMockSeats()[12];
    expect(getSeatCameraPose(seat, [0, 3.2, -4.4])).toEqual({
      position: { x: seat.x, y: seat.y + seat.eyeHeight, z: seat.z },
      target: { x: 0, y: 3.2, z: -4.4 },
    });
  });

  it("places Elite seating on raised rear steps and Lounger seating nearest the screen", () => {
    const seats = createMockSeats();
    const elite = seats.find((seat) => seat.row === "A");
    const frontElite = seats.find((seat) => seat.row === "N");
    const lounger = seats.find((seat) => seat.row === "O");

    expect(elite).toMatchObject({ category: "elite", y: 3.92 });
    expect(frontElite?.category).toBe("elite");
    expect(frontElite?.y).toBeCloseTo(0.28);
    expect(lounger).toMatchObject({ category: "lounger", y: 0 });
    expect(elite!.z).toBeGreaterThan(lounger!.z);
  });

  it("uses the supplied full-size cinema screen dimensions", () => {
    expect(mockSeatInventory.screen).toMatchObject({
      center: [0, 6, -18],
      width: 21.6,
      height: 11.4,
    });
    expect(mockSeatInventory.screen.width / mockSeatInventory.screen.height).toBeCloseTo(1.895);
  });

  it("supports a full horizontal look-around with a vertically constrained camera pitch", () => {
    expect(getLookDirection(0, 0)).toEqual({ x: 0, y: 0, z: -1 });
    expect(getLookDirection(Math.PI / 2, 0).x).toBeCloseTo(1);
    expect(getLookAngles(getLookDirection(Math.PI, 0))).toMatchObject({ yaw: Math.PI, pitch: 0 });
    expect(getLookAngles(getLookDirection(0, Math.PI / 4)).pitch).toBeCloseTo(Math.PI / 4);
  });
});
