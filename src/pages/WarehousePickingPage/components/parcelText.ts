import { placeOf } from '../../../features/fulfillment/lib/pickRules';
import type { PickTask } from '../../../features/fulfillment/model/fulfillmentTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';

/** Kartaning sarlavha osti: manzil, yetkazish, tasdiq vaqti — taklif maydonlari kelsa. */
export function useParcelSubline() {
  const { t } = useTranslation();
  return (task: PickTask, extra: (string | null)[] = []) => [
    placeOf(task),
    task.deliveryMode ? t(task.deliveryMode === 'DOOR' ? 'ful.mode.door' : 'ful.mode.center') : null,
    ...extra,
  ].filter(Boolean).join(' · ');
}

export const parcelTitle = (task: PickTask) => [task.orderNumber, task.customerName].filter(Boolean).join(' · ');
