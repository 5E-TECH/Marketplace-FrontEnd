import { useEffect, useState } from 'react';

/** A4 varaq kengligi ekranda (px, 96 dpi). */
export const SHEET_WIDTH = 794;

/** Telefonda A4 varaq ekranga sig'adi (`zoom`); chop etishda — haqiqiy o'lcham. */
export function useSheetScale() {
  const read = () => Math.min(1, (window.innerWidth - 32) / SHEET_WIDTH);
  const [scale, setScale] = useState(read);
  useEffect(() => {
    const onResize = () => setScale(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}
