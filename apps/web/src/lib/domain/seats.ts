import type { Seat } from "@/lib/api/types";

export type SeatSelectionAction =
  | { type: "toggle"; seatId: string }
  | { type: "remove"; seatId: string }
  | { type: "clear" };

export function updateSeatSelection(
  selection: readonly string[],
  action: SeatSelectionAction,
): string[] {
  switch (action.type) {
    case "toggle":
      return selection.includes(action.seatId)
        ? selection.filter((seatId) => seatId !== action.seatId)
        : [...selection, action.seatId];
    case "remove":
      return selection.filter((seatId) => seatId !== action.seatId);
    case "clear":
      return [];
  }
}

export function calculateSeatTotal(
  seats: readonly Seat[],
  selectedIds: readonly string[],
): number {
  const selected = new Set(selectedIds);
  return seats.reduce(
    (total, seat) => total + (selected.has(seat.id) ? seat.priceMinor : 0),
    0,
  );
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface SeatCameraPose {
  position: Point3;
  target: Point3;
}

export function getLookDirection(yaw: number, pitch: number): Point3 {
  const horizontal = Math.cos(pitch);
  return {
    x: horizontal * Math.sin(yaw),
    y: Math.sin(pitch),
    z: -horizontal * Math.cos(yaw),
  };
}

export function getLookAngles(direction: Point3): { yaw: number; pitch: number } {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length === 0) return { yaw: 0, pitch: 0 };
  return {
    yaw: Math.atan2(direction.x, -direction.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, direction.y / length))),
  };
}

export function getSeatCameraPose(
  seat: Seat,
  screenCenter: readonly [number, number, number],
): SeatCameraPose {
  return {
    position: { x: seat.x, y: seat.y + seat.eyeHeight, z: seat.z },
    target: { x: screenCenter[0], y: screenCenter[1], z: screenCenter[2] },
  };
}

export function formatPrice(amountMinor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
