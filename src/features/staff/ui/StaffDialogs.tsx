import type { UserRole } from '../../auth/model/authTypes';
import type { StaffSession, UserAccount } from '../model/staffTypes';
import { BlockDialog } from './BlockDialog';
import { PasswordResetDialog } from './PasswordResetDialog';
import { RoleDialog } from './RoleDialog';
import { SessionEndDialog } from './SessionEndDialog';
import { TwoFactorResetDialog } from './TwoFactorResetDialog';

export type StaffDialogKind = 'role' | 'block' | 'password' | 'tfa' | 'sessions';

export interface StaffDialogState {
  kind: StaffDialogKind;
  user: UserAccount;
  /** «Sessiyalar»: bitta sessiya; `null` — hammasi. */
  session?: StaffSession | null;
}

/**
 * Xodim oynalari — ro'yxat (qator menyusi) va karta bir xil oynalarni ochadi: rol (A, D1/D2), bloklash (B, D3),
 * parolni tiklash (D4), 2FA tiklash (D5), sessiyani tugatish (D6).
 */
export function StaffDialogs({ state, viewer, lastSuperadmin, onClose }: { state: StaffDialogState | null; viewer: { id: string; role: UserRole }; lastSuperadmin: boolean; onClose: () => void }) {
  if (!state) return null;
  const { kind, user } = state;
  if (kind === 'role') return <RoleDialog user={user} viewer={viewer} lastSuperadmin={lastSuperadmin} onClose={onClose} />;
  if (kind === 'block') return <BlockDialog user={user} onClose={onClose} />;
  if (kind === 'password') return <PasswordResetDialog user={user} onClose={onClose} />;
  if (kind === 'tfa') return <TwoFactorResetDialog user={user} onClose={onClose} />;
  return <SessionEndDialog user={user} session={state.session ?? null} onClose={onClose} />;
}
