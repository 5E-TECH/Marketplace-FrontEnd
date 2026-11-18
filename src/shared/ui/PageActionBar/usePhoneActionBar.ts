import { useMediaQuery } from '../../lib/useMediaQuery';

/** Telefondami — sahifaning asosiy tugmalari pastki panelga ko'chadi (karkas-E 4.4). */
export function usePhoneActionBar(): boolean {
  return useMediaQuery('(max-width: 767.98px)');
}
