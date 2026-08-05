import type { AuthUser } from '../model/authTypes';

/** Seller kabinetining frontend shelliga kira oladigan rollar. */
export function canAccessSellerCabinet(
  user: Pick<AuthUser, 'role' | 'isDeleted'>,
): boolean {
  return (
    !user.isDeleted &&
    (user.role === 'SELLER' ||
      user.role === 'ADMIN' ||
      user.role === 'SUPERADMIN')
  );
}
