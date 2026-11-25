import type { AdminLeadAttempt } from '../../../features/adminLeads/model/adminLeadTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { dayTime } from '../../../shared/lib/dayTime';
import type { BadgeTone } from '../../../shared/ui/Badge/Badge';

/** Lid kartasi (admin-lid-karta): vaqt ko'rinishlari va urinish natijalari. Vaqt — Toshkent. */
type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** «14:36» bugun, aks holda «11.01, 15:03». */
export { shortTime } from '../../../shared/lib/dayTime';

/** «bugun, 14:36», «kecha, 10:12», «11.01.2027, 15:00» — kichik harf bilan (gap ichida). */
export const relativeDay = (value: string, t: T, now = Date.now()) => dayTime(value, t, now, true);

/** «08:18» — soniyalar (davomiylik, qolgan vaqt). */
export function mmss(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/** Urinish natijasi belgisi: tasdiq — yashil, rad — qizil, suhbatda va keyinroq — sariq, javobsiz — kulrang. */
export function outcomeBadge(outcome: AdminLeadAttempt['outcome'], t: T): { tone: BadgeTone; label: string } {
  switch (outcome) {
    case 'IN_CALL':
      return { tone: 'warning', label: t('alk.u.inCall') };
    case 'CONFIRMED':
      return { tone: 'success', label: t('status.lead.CONFIRMED') };
    case 'REJECTED':
      return { tone: 'danger', label: t('status.lead.REJECTED') };
    case 'CALL_LATER':
    case 'THINKING':
      return { tone: 'warning', label: t(`opw.outcome.${outcome}`) };
    case 'INVALID':
      return { tone: 'neutral', label: t('status.lead.INVALID') };
    case 'DUPLICATE':
      return { tone: 'neutral', label: t('status.lead.MERGED') };
    default:
      return { tone: 'neutral', label: t(`opw.outcome.${outcome}`) };
  }
}

/** Suhbat bo'lgan, lekin yozuvi yo'q urinish — hisobotda xato (admin-lid-karta «Yozuvsiz urinish»). */
export const missingRecording = (attempt: AdminLeadAttempt) => attempt.recording === 'NONE' && attempt.outcome !== 'IN_CALL';
