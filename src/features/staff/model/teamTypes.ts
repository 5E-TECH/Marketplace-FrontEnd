import type { Softphone } from './operatorTypes';
import type { UserAccount } from './staffTypes';

/**
 * Nazoratchi jamoasi (FE-15 «Jamoa», nazoratchi-jamoa): taklif `GET /supervisor/team` (fe-15 §14). Hisob holati —
 * «Faol», «Hali kirmagan», «Nofaol» (nazoratchi), «Bloklash so‘ralgan» (admin javobi kutilmoqda), «Bloklangan» (admin).
 */
export type MemberState = 'ACTIVE' | 'NEVER_LOGGED_IN' | 'INACTIVE' | 'BLOCK_REQUESTED' | 'BLOCKED';
export const MEMBER_STATES: readonly MemberState[] = ['ACTIVE', 'NEVER_LOGGED_IN', 'INACTIVE', 'BLOCK_REQUESTED', 'BLOCKED'];

export interface TeamMember {
  user: UserAccount;
  softphone: Softphone | null;
  /** Nazoratchi nofaol qilgan: qachon, kim, sabab. */
  inactive: { at: string; by: string; reason: string } | null;
  /** Admin'ga so'rov (javob kutilmoqda): bloklash yoki blokdan chiqarish. */
  request: { kind: 'BLOCK' | 'UNBLOCK'; at: string; by: string; reason: string } | null;
}

export interface SupervisorTeam {
  /** null — nazoratchiga hali jamoa biriktirilmagan (admin yaratadi). */
  team: { id: string; supervisorId: string; supervisorName: string } | null;
  members: TeamMember[];
}

export interface MemberInput {
  firstName: string;
  lastName: string;
  /** `+998XXXXXXXXX`. */
  phone: string;
  workspace: 'BROWSER' | 'SIP';
}

/** Blok ustun, keyin admin'ga bloklash so'rovi, nofaol, hali kirmagan. */
export function memberState(member: TeamMember): MemberState {
  if (member.user.isBlocked) return 'BLOCKED';
  if (member.request?.kind === 'BLOCK') return 'BLOCK_REQUESTED';
  if (!member.user.isActive) return 'INACTIVE';
  if (member.user.lastLoginAt === null) return 'NEVER_LOGGED_IN';
  return 'ACTIVE';
}
