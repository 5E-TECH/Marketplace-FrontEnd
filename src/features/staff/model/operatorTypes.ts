/**
 * «Operatorlar jamoasi» (FE-15, admin-operatorlar-jamoasi): jonli holat — BE-13/BE-25 `queue-summary`; softfon hisobi
 * va har operator ko'rsatkichlari — taklif (docs/api-taklif/fe-15-admin-foydalanuvchilar.md §13).
 */
export type WorkState = 'ONLINE' | 'BREAK' | 'OFFLINE';
export type ActivityKind = 'CONNECTING' | 'RINGING' | 'IN_CALL' | 'WRAP_UP' | 'IDLE';

export interface OperatorLive {
  operatorId: string;
  state: WorkState;
  /** Taklif: holat qachondan («13:15 dan»); backend bermasa — null. */
  since: string | null;
  activeBookings: number;
  maxBookings: number;
  scheduledCalls: number;
  /** Telefoniya ulanmagan bo'lsa — null. */
  activity: { kind: ActivityKind; leadId: string | null; since: string | null } | null;
}

/** Ish joyi: brauzer softfoni (WebRTC), stol telefoni (SIP); mobil ilova — 2-bosqich. */
export type Workspace = 'BROWSER' | 'SIP' | 'APP';
export const WORKSPACES: readonly Workspace[] = ['BROWSER', 'SIP', 'APP'];

/** Softfon hisobi holati: serverda ro'yxatda, ulanmagan, o'chirilgan (blokda). */
export type SoftphoneStatus = 'REGISTERED' | 'UNREGISTERED' | 'DISABLED';
export const SOFTPHONE_STATUSES: readonly SoftphoneStatus[] = ['REGISTERED', 'UNREGISTERED', 'DISABLED'];

export interface Softphone {
  operatorId: string;
  /** SIP hisob — operator ID sidan («2088»). */
  account: string;
  status: SoftphoneStatus;
  /** Shu holat qachondan (ro'yxatdan o'tgan payt). */
  since: string | null;
  workspace: Workspace;
  /** Hali birinchi marta ulanmagan (yangi operator: «birinchi kirishda ulanadi»). */
  neverConnected: boolean;
  /** Ish joyi o'zgarishi suhbat tugagach kuchga kiradi. */
  pendingWorkspace: Workspace | null;
}

export type StatsPeriod = 'today' | 'week';

/** Operator ko'rsatkichlari (BE-13 `OperatorStatsDto` bilan bir xil maydonlar; `valid` — taklif). */
export interface OperatorStatsRow {
  operatorId: string;
  attempts: number;
  confirmed: number;
  /** Tasdiq foizi maxraji: shu davrda ishlagan yaroqli lidlar. */
  valid: number;
  approveRate: number | null;
  firstCallMedianMinutes: number | null;
}
