import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Saqlanmagan o'zgarish bilan chiqishni so'rash: ilova ichidagi havolalar (menyu, «‹ Orqaga») bosilsa
 * o'tish to'xtatiladi va `pending` ga yoziladi; sahifani yopish yoki yangilashda — brauzer oynasi.
 * Ilova `BrowserRouter` da (data router emas) — shuning uchun `useBlocker` o'rniga havolalarni ushlaydi.
 */
export function useLeaveGuard(active: boolean) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      const here = window.location;
      if (url.origin !== here.origin || url.pathname + url.search === here.pathname + here.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [active]);

  return {
    pending,
    stay: () => setPending(null),
    leave: () => {
      const target = pending;
      setPending(null);
      if (target) void navigate(target);
    },
  };
}
