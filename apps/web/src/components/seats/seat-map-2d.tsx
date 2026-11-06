"use client";

import type { Seat } from "@/lib/api/types";
import { formatPrice } from "@/lib/domain/seats";

interface SeatMap2DProps {
  seats: Seat[];
  selectedIds: string[];
  onToggle: (seatId: string) => void;
}

export function SeatMap2D({ seats, selectedIds, onToggle }: SeatMap2DProps) {
  const rows = [...new Set(seats.map((seat) => seat.row))];
  return (
    <div aria-label="Interactive seat map" className="seat-map">
      <div className="screen-arc"><span>SCREEN</span></div>
      <div className="seat-rows">
        {rows.map((row) => (
          <div className="seat-row" key={row}>
            <span aria-hidden="true" className="row-label">{row}</span>
            <div className="seat-row-buttons">
              {seats.filter((seat) => seat.row === row).map((seat) => {
                const selected = selectedIds.includes(seat.id);
                const unavailable = seat.availability !== "available" && !selected;
                return (
                  <button
                    aria-checked={selected}
                    aria-label={`Row ${seat.row}, seat ${seat.number}, ${selected ? "selected" : seat.availability}, ${seat.category}, ${formatPrice(seat.priceMinor)}`}
                    className={`seat-button ${seat.category} ${selected ? "selected" : ""} ${unavailable ? seat.availability : ""}`}
                    disabled={unavailable}
                    key={seat.id}
                    onClick={() => onToggle(seat.id)}
                    role="checkbox"
                    type="button"
                  >
                    <span>{seat.number}</span>
                  </button>
                );
              })}
            </div>
            <span aria-hidden="true" className="row-label">{row}</span>
          </div>
        ))}
      </div>
      <div aria-label="Seat availability legend" className="seat-legend">
        <span><i className="legend-seat available" /> Available</span>
        <span><i className="legend-seat selected" /> Selected</span>
        <span><i className="legend-seat held" /> On hold</span>
        <span><i className="legend-seat booked" /> Booked</span>
        <span><i className="legend-seat elite" /> Elite</span>
        <span><i className="legend-seat lounger" /> Lounger</span>
      </div>
    </div>
  );
}
