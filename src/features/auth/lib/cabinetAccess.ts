import { isUserRole, type AuthUser } from '../model/authTypes';

/**
 * Panelga kira oladigan foydalanuvchi: 8 rolning har biri o'z karkasiga ega
 * (qaysi sahifa kimga ochiqligini marshrut manifesti hal qiladi).
 * O'chirilgan akkaunt panelga kirmaydi.
 */
export function canAccessCabinet(user: Pick<AuthUser, 'role' | 'isDeleted'>): boolean {
  return !user.isDeleted && isUserRole(user.role);
}
