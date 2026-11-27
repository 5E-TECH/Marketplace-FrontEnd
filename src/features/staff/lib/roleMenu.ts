import { getNavGroups } from '../../../app/router/routeAccess';
import type { UserRole } from '../../auth/model/authTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';

/**
 * Rol menyusi bandlari — marshrut manifestidan (karkasdagi menyu bilan bir xil, M1 bandlari): «Rol berish» oynasidagi
 * «Menyusi», rol paneli. Rol berilsa xodim aynan shu menyuni ko'radi (FE-15 TC1).
 */
export function roleMenuKeys(role: UserRole): TranslationKey[] {
  return getNavGroups(role).flatMap((group) => group.routes.map((route) => route.label));
}
