import { CheckoutPanel } from "@/components/checkout-panel";

export default async function CheckoutPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <CheckoutPanel bookingId={bookingId} />;
}
