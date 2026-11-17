/**
 * Backend frontend bilmagan rolni qaytardi (masalan, eski SELLER yoki yangi
 * qo'shilgan rol). Profil "yuklanmadi" emas — bu rol uchun ish joyi yo'q:
 * panel menyusiz ochiladi va sababni ko'rsatadi (umumiy-403 «Noma’lum rol»).
 */
export class UnknownRoleError extends Error {
  readonly role: string;
  readonly userId: string | null;
  readonly userName: string | null;

  constructor(role: string, user: { id?: unknown; name?: unknown } = {}) {
    super(`Bu rol uchun panel mavjud emas: ${role}`);
    this.name = 'UnknownRoleError';
    this.role = role;
    this.userId = typeof user.id === 'string' || typeof user.id === 'number' ? String(user.id) : null;
    this.userName = typeof user.name === 'string' ? user.name : null;
  }
}
