import {
  Award, Building2, ChartColumn, ClockAlert, CreditCard, Gauge, House, LayoutTemplate, MessageSquareText, Package,
  PackagePlus, Phone, ReceiptText, ShieldAlert, ShieldCheck, ShoppingBag, Stamp, Undo2, UserRound, Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../../auth/model/authTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';

/** Band qaysi buildda chiqadi (karkas-E §2 «Bosqich»): M1 — hozir menyuda; M2 — 2-bosqich; «?» — qaror kutilmoqda. */
export type MenuStage = 'M1' | 'M2' | 'TBD';

export interface MenuPlanItem {
  label: TranslationKey;
  stage: MenuStage;
  /** M1 bandi ikonkasi marshrut manifestidan olinadi; keyingi bosqich bandlari menyuda yo'q — ikonka shu yerda. */
  icon?: LucideIcon;
}

const m1 = (label: TranslationKey): MenuPlanItem => ({ label, stage: 'M1' });
const later = (label: TranslationKey, icon: LucideIcon, stage: MenuStage = 'M2'): MenuPlanItem => ({ label, stage, icon });

const ADMIN_TAIL: readonly MenuPlanItem[] = [
  m1('nav.moderation'), m1('nav.leads'), m1('nav.orders'), m1('nav.products'), m1('adminNav.categories'), m1('nav.stock'),
  later('staff.menuItem.siteContent', LayoutTemplate), m1('adminNav.sellerList'), m1('nav.wholesalers'),
  later('staff.menuItem.fraud', ShieldAlert), m1('nav.callRecordings'), later('staff.menuItem.tickets', MessageSquareText, 'TBD'),
  m1('nav.auditJournal'), m1('adminNav.users'), m1('nav.integrations'), m1('nav.settings'),
];

/**
 * Har rol menyusi to'liq (karkas-E §2, v2): rol panelidagi «Menyu · N band» va «Sakkiz rol» jadvalidagi «19 band · M1 da
 * 13». M1 bandlari marshrut manifesti bilan bir xil bo'lishi unit testda tekshiriladi (`menuPlan.test.ts`).
 */
export const MENU_PLAN: Record<UserRole, readonly MenuPlanItem[]> = {
  AFFILIATE: [
    m1('nav.home'), m1('nav.offers'), m1('nav.myPages'), m1('nav.statistics'), m1('nav.leads'), m1('nav.balance'),
    m1('nav.postbackApi'), later('staff.menuItem.quality', ShieldCheck), m1('nav.profileShort'),
  ],
  WHOLESALER: [
    later('nav.home', House), later('nav.products', Package), later('staff.menuItem.supplies', PackagePlus), later('nav.stock', Warehouse),
    later('nav.orders', ShoppingBag), later('staff.menuItem.returns', Undo2), later('staff.menuItem.payments', ReceiptText),
    later('nav.profileShort', UserRound),
  ],
  OPERATOR_LEAD: [m1('nav.operatorWorkspace'), m1('nav.scheduledCalls'), m1('nav.myCalls'), m1('nav.myOrders'), m1('nav.myStatistics')],
  SUPERVISOR: [
    later('staff.menuItem.dashboard', Gauge), later('staff.menuItem.workspace', Phone, 'TBD'), m1('nav.queue'), m1('nav.leads'),
    m1('nav.orders'), m1('nav.operators'), m1('nav.callRecordings'), later('staff.menuItem.redList', ClockAlert),
  ],
  WAREHOUSE: [
    later('staff.menuItem.today', House, 'TBD'), m1('nav.inbound'), m1('nav.skuCells'), m1('nav.stock'), m1('nav.pickPack'),
    m1('nav.handover'), m1('nav.returnsSorting'), m1('nav.toWholesaler'),
  ],
  FINANCE: [
    m1('nav.elchiReconciliation'), m1('nav.accounts'), m1('nav.withdrawals'), m1('nav.receipts'),
    later('staff.menuItem.wholesalerAccounts', Building2), later('staff.menuItem.onlinePayments', CreditCard, 'TBD'),
    later('staff.menuItem.operatorBonuses', Award, 'TBD'),
  ],
  ADMIN: [later('staff.menuItem.dashboard', Gauge), later('staff.menuItem.reports', ChartColumn), ...ADMIN_TAIL],
  SUPERADMIN: [
    later('staff.menuItem.dashboard', Gauge), later('staff.menuItem.approvals', Stamp, 'TBD'), later('staff.menuItem.reports', ChartColumn),
    ...ADMIN_TAIL,
  ],
};

/** «19 band · M1 da 13». */
export function menuStats(role: UserRole): { total: number; current: number } {
  const plan = MENU_PLAN[role];
  return { total: plan.length, current: plan.filter((item) => item.stage === 'M1').length };
}
