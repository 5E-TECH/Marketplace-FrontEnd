import { useState } from 'react';
import { TWO_FACTOR_BLOCK_SECONDS, TWO_FACTOR_MAX_ATTEMPTS } from '../../../features/auth/api/twoFactorApi';
import { useCountdown } from '../../../features/sellerAuth/lib/useCountdown';

/**
 * 2FA kodi urinishlari (BE-26: 3 xato → 15 daqiqa blok; kirish va ulash bir hisobda). Backend qolgan urinishni
 * (taklif `attemptsLeft`) bermasa — shu bosqichda o'zi sanaydi; 0 qolsa blok qo'yiladi (backend uni shu urinishda
 * qo'ygan, keyingi so'rov 423).
 */
export function useAttemptGuard() {
  const [failures, setFailures] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const left = useCountdown(blockedUntil);

  const block = (seconds: number) => setBlockedUntil(Date.now() + seconds * 1000);

  /** Xato kod: qolgan urinishlar soni; `0` — blok qo'yildi. */
  const wrong = (attemptsLeft: number | null) => {
    const used = failures + 1;
    setFailures(used);
    const rest = attemptsLeft ?? Math.max(0, TWO_FACTOR_MAX_ATTEMPTS - used);
    if (rest <= 0) block(TWO_FACTOR_BLOCK_SECONDS);
    return rest;
  };

  return { left, blocked: blockedUntil !== null && left > 0, block, wrong };
}
