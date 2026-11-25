import { CirclePause, CirclePlay, Pencil, Send, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { cabinetState, hasContract } from '../../../features/wholesalers/lib/wholesalerRules';
import type { Wholesaler } from '../../../features/wholesalers/model/wholesalerTypes';
import type { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { legalTypeLabel, type CardDialog } from './cardView';

export type HeadAction = CardDialog | 'edit' | 'declare' | 'addProduct';

export function headMeta(wholesaler: Wholesaler, t: ReturnType<typeof useTranslation>['t']): string {
  const added = `${t('whk.head.added', { when: tashkentDateTime(wholesaler.createdAt) })}${wholesaler.createdBy ? ` — ${shortPersonName(wholesaler.createdBy)}` : ''}`;
  return [legalTypeLabel(wholesaler, t).replace(/ \(.*\)$/, ''), t('whs.tin', { tin: wholesaler.tin ?? '—' }), wholesaler.address, added].filter(Boolean).join(' · ');
}

/** Menyu bandlari (desktop «⋯», telefon «⋮» varag'i bir xil ro'yxatdan). */
export function headMenuItems(wholesaler: Wholesaler, compact: boolean, t: ReturnType<typeof useTranslation>['t']) {
  const cabinet = cabinetState(wholesaler);
  const suspended = wholesaler.status === 'SUSPENDED';
  const pending = wholesaler.status === 'PENDING';
  const items: { key: HeadAction; icon: ReactNode; label: string; reason?: string | null; danger?: boolean }[] = [];
  if (compact && !pending && !suspended) {
    items.push({ key: 'act', icon: <Send aria-hidden />, label: t('whs.menu.act'), reason: hasContract(wholesaler) ? null : t('whs.block.noAct') });
  }
  items.push({ key: 'edit', icon: <Pencil aria-hidden />, label: t('whk.head.edit') });
  if (!pending) {
    items.push({
      key: 'invite',
      icon: <Smartphone aria-hidden />,
      label: t(cabinet === 'NONE' ? 'whs.menu.invite' : 'whs.menu.reinvite'),
      reason: cabinet === 'ACTIVE' ? t('whs.block.cabinetActive') : suspended ? t('whs.block.SUSPENDED') : null,
    });
    items.push(suspended
      ? { key: 'resume', icon: <CirclePlay aria-hidden />, label: t('whs.menu.resume') }
      : { key: 'suspend', icon: <CirclePause aria-hidden />, label: t('whs.menu.suspend'), danger: true });
  }
  return items;
}

