import type { ShellVariant } from '../../app/router/routeManifest';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import type { ShellLayout } from './TopBar';

const PHONE = '(max-width: 767.98px)';
const BELOW_DESKTOP = '(max-width: 1023.98px)';
const BELOW_WIDE = '(max-width: 1279.98px)';

/**
 * Karkas ko'rinishi (karkas-E 4.1, 5.4, 5.5): telefon < 768; planshet 768–1023;
 * operator ish joyi va omborchi uchun desktop 1280 dan. Omborchi 768–1279 da
 * chap panel o'rniga 96 px relsi oladi.
 */
export function useShellLayout(variant: ShellVariant = 'panel'): ShellLayout {
  const phone = useMediaQuery(PHONE);
  const narrow = useMediaQuery(variant === 'panel' ? BELOW_DESKTOP : BELOW_WIDE);
  if (phone) return 'phone';
  if (!narrow) return 'desktop';
  return variant === 'rail' ? 'rail' : 'tablet';
}
