import { Ban, CircleCheck, CircleDot, CirclePause, Clock, Headset, History, Pencil, Send, ShieldAlert, UserCheck, UserMinus, type LucideIcon } from 'lucide-react';
import { lastLoginText } from '../../../features/staff/lib/staffFormat';
import type { MemberState } from '../../../features/staff/model/teamTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import type { BadgeTone } from '../../../shared/ui/Badge/Badge';
import type { MemberRow } from './teamMembers';

export type MemberAction = 'edit' | 'now' | 'history' | 'deactivate' | 'activate' | 'block' | 'unblock';

export const STATE_VIEW: Record<MemberState, { tone: BadgeTone; icon: LucideIcon }> = {
  ACTIVE: { tone: 'success', icon: CircleCheck },
  NEVER_LOGGED_IN: { tone: 'info', icon: CircleDot },
  INACTIVE: { tone: 'neutral', icon: CirclePause },
  BLOCK_REQUESTED: { tone: 'warning', icon: Clock },
  BLOCKED: { tone: 'danger', icon: Ban },
};

/** Softfon holati yorlig'i: nofaol — «To‘xtatilgan», blok — «O‘chirilgan». */
export function softphoneLabel(row: MemberRow, lower = false): TranslationKey | null {
  const phone = row.member.softphone;
  if (!phone) return null;
  if (phone.status === 'DISABLED' && row.state === 'INACTIVE') return lower ? 'staff.sv.spLower.paused' : 'staff.sv.sp.paused';
  return lower ? `staff.ops.spLower.${phone.status}` : `staff.ops.sp.${phone.status}`;
}

export function lastLoginValue(row: MemberRow, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
  const at = row.member.user.lastLoginAt;
  return at ? lastLoginText(at, t) : at === null ? t('staff.sv.never') : '—';
}

export interface MenuEntry { key: MemberAction; icon: LucideIcon; label: TranslationKey; disabled?: string; danger?: boolean }

/** Qator menyusi bandlari holatga qarab (nazoratchi-jamoa.holatlar «Qator menyusi», «Bloklangan»). */
export function menuEntries(row: MemberRow, inCallReason: string | null): MenuEntry[][] {
  const { state, member } = row;
  if (state === 'BLOCKED') {
    return [[
      member.request?.kind === 'UNBLOCK'
        ? { key: 'unblock', icon: Send, label: 'staff.sv.menu.requested', disabled: '' }
        : { key: 'unblock', icon: Send, label: 'staff.sv.menu.unblock' },
      { key: 'history', icon: History, label: 'staff.sv.menu.history' },
    ]];
  }
  const head: MenuEntry[] = [
    { key: 'edit', icon: Pencil, label: 'staff.sv.menu.edit' },
    ...(state === 'INACTIVE' ? [] : [{ key: 'now' as const, icon: Headset, label: 'staff.sv.menu.now' as TranslationKey }]),
    { key: 'history', icon: History, label: 'staff.sv.menu.history' },
  ];
  const tail: MenuEntry[] = [
    state === 'INACTIVE'
      ? { key: 'activate', icon: UserCheck, label: 'staff.sv.menu.activate' }
      : { key: 'deactivate', icon: UserMinus, label: 'staff.sv.menu.deactivate', disabled: inCallReason ?? undefined },
    state === 'BLOCK_REQUESTED'
      ? { key: 'block', icon: ShieldAlert, label: 'staff.sv.menu.requested', disabled: '' }
      : { key: 'block', icon: ShieldAlert, label: 'staff.sv.menu.block', danger: true },
  ];
  return [head, tail];
}

