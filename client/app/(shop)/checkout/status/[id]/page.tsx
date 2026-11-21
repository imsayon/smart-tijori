import { PaymentStatus } from '@/components/shop/checkout/payment-status';

export default async function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  return <PaymentStatus reservationId={(await params).id} />;
}
