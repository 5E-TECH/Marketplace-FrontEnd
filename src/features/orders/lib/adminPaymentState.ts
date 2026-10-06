import type { AdminOrder } from '../model/orderTypes';

export type AdminPaymentState = 'COD' | 'PENDING_PAYMENT' | 'PAID' | 'REFUNDED' | 'CANCELLED';

const FROM_PAYMENT: Record<string, Exclude<AdminPaymentState, 'COD'>> = {
  CREATED: 'PENDING_PAYMENT', PENDING: 'PENDING_PAYMENT', PAID: 'PAID', REFUNDED: 'REFUNDED', CANCELLED: 'CANCELLED', FAILED: 'CANCELLED',
};
const FROM_ORDER: Record<string, Exclude<AdminPaymentState, 'COD'>> = {
  DRAFT: 'PENDING_PAYMENT', PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID', CONFIRMED: 'PAID', PARTIALLY_FULFILLED: 'PAID', FULFILLED: 'PAID',
  REFUNDED: 'REFUNDED', CANCELLED: 'CANCELLED',
};

/**
 * Admin buyurtmasining to'lov holati. `GET /admin/orders(/:id)` to'lov holatini bermaydi, shuning uchun u buyurtma
 * holatidan chiqariladi: backend online buyurtmani `PENDING_PAYMENT` → `CONFIRMED` ga faqat to'lov tasdiqlangach
 * o'tkazadi (checkout `confirmPaid`), refund esa `REFUNDED` qiladi. Backend `paymentStatus` qaytarsa — u ustun.
 * COD'da online to'lov yo'q: pul yetkazilganda olinadi.
 */
export function getAdminPaymentState(order: Pick<AdminOrder, 'paymentMethod' | 'paymentStatus' | 'status'>): AdminPaymentState | null {
  if (order.paymentMethod === 'cod') return 'COD';
  if (order.paymentMethod !== 'online') return null;
  return FROM_PAYMENT[order.paymentStatus?.toUpperCase() ?? ''] ?? FROM_ORDER[order.status] ?? null;
}
