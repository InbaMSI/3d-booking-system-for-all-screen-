import { BookingStatusPanel } from "@/components/booking-status-panel";

export default async function BookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <BookingStatusPanel bookingId={bookingId} />;
}
