import {
  ArrowLeftRight,
  AudioLines,
  Banknote,
  Building2,
  CalendarClock,
  ChartColumn,
  FolderTree,
  Headset,
  History,
  House,
  Inbox,
  Landmark,
  Link,
  ListChecks,
  ListOrdered,
  Package,
  PackageCheck,
  PackagePlus,
  Plug,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Undo2,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  Webhook,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { USER_ROLES, type UserRole } from '../../features/auth/model/authTypes';
import type { TranslationKey } from '../../shared/i18n/translations';

/**
 * Yagona marshrut manifesti (FE-01). Router, menyu, sarlavha, preload va rol
 * tekshiruvi shu ro'yxatdan olinadi — yangi sahifa faqat shu yerga qo'shiladi.
 * Massiv tartibi menyu tartibi. Menyular — docs/dizayn/karkas-E.md 2-bo'lim:
 * faqat M1 bandlari; M2 va «?» bandlari M1 build'da chiqmaydi.
 */

type PageModule = { default: ComponentType };

export interface AppRoute {
  /** To'liq yo'l: `/admin/users/:userId`. */
  path: string;
  load: () => Promise<PageModule>;
  /** Kim ochadi (backend @Roles bilan mos) — boshqa rol 403 sahifani ko'radi. */
  roles: readonly UserRole[];
  /** Menyu bandi va yuqori qatordagi `h1`. */
  label: TranslationKey;
  /** Berilsa — band menyuda shu ikonka bilan chiqadi. */
  navIcon?: ReactNode;
  /** Menyuda kimga ko'rinadi (sukut — `roles`). Masalan Profil faqat sotuvchi menyusida. */
  navRoles?: readonly UserRole[];
  /** Admin menyusidagi guruh (karkas-E 1.4); guruhning birinchi bandi oldida sarlavha chiqadi. */
  navGroup?: TranslationKey;
  /** Ichki sahifa: menyuda shu bo'lim faol, yuqori qatorda «‹ Bo'lim» havolasi. */
  section?: string;
  /** Omborchi relsidagi qisqa yorliq (karkas-E 5.5). */
  railLabel?: TranslationKey;
}

/**
 * `panel` — 260 px menyu + yuqori qator; `workspace` — operator: 1280 px dan tor
 * ekranda planshet karkasi, telefonda «Faqat kompyuterda»; `rail` — omborchi:
 * 768–1279 px da 96 px relsi (karkas-E 4.1, 5.4, 5.5).
 */
export type ShellVariant = 'panel' | 'workspace' | 'rail';

export interface RoleShell {
  home: string;
  variant: ShellVariant;
  /** `admin` — admin va superadmin menyusi (guruhlar bilan). */
  area: 'admin' | 'cabinet';
  /** Foydalanuvchi menyusidagi «Profil». */
  profilePath: string;
}

const ADMIN_ROLES: readonly UserRole[] = ['ADMIN', 'SUPERADMIN'];

export const roleShells: Record<UserRole, RoleShell> = {
  AFFILIATE: { home: '/affiliate', variant: 'panel', area: 'cabinet', profilePath: '/profile' },
  WHOLESALER: { home: '/wholesaler', variant: 'panel', area: 'cabinet', profilePath: '/profile' },
  OPERATOR_LEAD: { home: '/operator', variant: 'workspace', area: 'cabinet', profilePath: '/profile' },
  SUPERVISOR: { home: '/supervisor', variant: 'panel', area: 'cabinet', profilePath: '/profile' },
  WAREHOUSE: { home: '/warehouse', variant: 'rail', area: 'cabinet', profilePath: '/profile' },
  FINANCE: { home: '/finance', variant: 'panel', area: 'cabinet', profilePath: '/profile' },
  ADMIN: { home: '/admin/moderation', variant: 'panel', area: 'admin', profilePath: '/admin/profile' },
  SUPERADMIN: { home: '/admin/moderation', variant: 'panel', area: 'admin', profilePath: '/admin/profile' },
};

// Sahifasi hali qurilmagan bandlar: o'z kartasi kelganda shu yerda `load` almashtiriladi.
const pending = () => import('../../pages/PlaceholderPage/PlaceholderPage');
const profile = () => import('../../pages/ProfilePage/ProfilePage');

export const appRoutes: readonly AppRoute[] = [
  // ── Sotuvchi (karkas-E 2.1) ────────────────────────────────────────────────
  { path: '/affiliate', load: () => import('../../pages/AffiliateHomePage/AffiliateHomePage'), roles: ['AFFILIATE'], label: 'nav.home', navIcon: <House /> },
  { path: '/affiliate/offers', load: () => import('../../pages/AffiliateOffersPage/AffiliateOffersPage'), roles: ['AFFILIATE'], label: 'nav.offers', navIcon: <Tag /> },
  { path: '/affiliate/offers/:productId', load: () => import('../../pages/AffiliateOfferPage/AffiliateOfferPage'), roles: ['AFFILIATE'], label: 'nav.offers', section: '/affiliate/offers' },
  { path: '/affiliate/pages', load: () => import('../../pages/AffiliatePagesPage/AffiliatePagesPage'), roles: ['AFFILIATE'], label: 'nav.myPages', navIcon: <Link /> },
  { path: '/affiliate/pages/:id', load: () => import('../../pages/AffiliatePageSettingsPage/AffiliatePageSettingsPage'), roles: ['AFFILIATE'], label: 'settings.title', section: '/affiliate/pages' },
  { path: '/affiliate/stats', load: () => import('../../pages/AffiliateStatsPage/AffiliateStatsPage'), roles: ['AFFILIATE'], label: 'nav.statistics', navIcon: <ChartColumn /> },
  { path: '/affiliate/leads', load: pending, roles: ['AFFILIATE'], label: 'nav.leads', navIcon: <Inbox /> },
  { path: '/affiliate/balance', load: pending, roles: ['AFFILIATE'], label: 'nav.balance', navIcon: <Wallet /> },
  { path: '/affiliate/postback', load: pending, roles: ['AFFILIATE'], label: 'nav.postbackApi', navIcon: <Webhook /> },
  { path: '/profile', load: profile, roles: USER_ROLES, label: 'nav.profileShort', navIcon: <UserRound />, navRoles: ['AFFILIATE'] },
  { path: '/profile/self-employed', load: () => import('../../pages/SellerProfilePage/SelfEmployedPage'), roles: ['AFFILIATE'], label: 'selfEmployed.title', section: '/profile' },
  { path: '/profile/offer', load: () => import('../../pages/SellerProfilePage/AgreementsPage'), roles: ['AFFILIATE'], label: 'sellerProfile.agreementsTitle', section: '/profile' },

  // ── Operator (2.2) ─────────────────────────────────────────────────────────
  { path: '/operator', load: () => import('../../pages/OperatorHomePage/OperatorHomePage'), roles: ['OPERATOR_LEAD'], label: 'nav.operatorWorkspace', navIcon: <Headset /> },
  { path: '/operator/callbacks', load: () => import('../../pages/OperatorCallbacksPage/OperatorCallbacksPage'), roles: ['OPERATOR_LEAD'], label: 'nav.scheduledCalls', navIcon: <CalendarClock /> },
  { path: '/operator/calls', load: pending, roles: ['OPERATOR_LEAD'], label: 'nav.myCalls', navIcon: <AudioLines /> },
  { path: '/operator/orders', load: pending, roles: ['OPERATOR_LEAD'], label: 'nav.myOrders', navIcon: <ShoppingBag /> },
  { path: '/operator/stats', load: pending, roles: ['OPERATOR_LEAD'], label: 'nav.myStatistics', navIcon: <ChartColumn /> },

  // ── Nazoratchi (2.3) ───────────────────────────────────────────────────────
  { path: '/supervisor', load: pending, roles: ['SUPERVISOR'], label: 'nav.queue', navIcon: <ListOrdered /> },
  { path: '/supervisor/leads', load: pending, roles: ['SUPERVISOR'], label: 'nav.leads', navIcon: <Inbox /> },
  { path: '/supervisor/orders', load: pending, roles: ['SUPERVISOR'], label: 'nav.orders', navIcon: <ShoppingBag /> },
  { path: '/supervisor/operators', load: pending, roles: ['SUPERVISOR'], label: 'nav.operators', navIcon: <Headset /> },
  { path: '/supervisor/recordings', load: pending, roles: ['SUPERVISOR'], label: 'nav.callRecordings', navIcon: <AudioLines /> },

  // ── Omborchi (2.6) ─────────────────────────────────────────────────────────
  { path: '/warehouse', load: pending, roles: ['WAREHOUSE'], label: 'nav.inbound', navIcon: <PackagePlus />, railLabel: 'rail.inbound' },
  { path: '/warehouse/sku', load: pending, roles: ['WAREHOUSE'], label: 'nav.skuCells', navIcon: <ScanBarcode />, railLabel: 'rail.sku' },
  { path: '/warehouse/stock', load: pending, roles: ['WAREHOUSE'], label: 'nav.stock', navIcon: <Warehouse />, railLabel: 'rail.stock' },
  { path: '/warehouse/picking', load: pending, roles: ['WAREHOUSE'], label: 'nav.pickPack', navIcon: <PackageCheck />, railLabel: 'rail.pick' },
  { path: '/warehouse/handover', load: pending, roles: ['WAREHOUSE'], label: 'nav.handover', navIcon: <Truck />, railLabel: 'rail.handover' },
  { path: '/warehouse/returns', load: pending, roles: ['WAREHOUSE'], label: 'nav.returnsSorting', navIcon: <Undo2 />, railLabel: 'rail.returns' },
  { path: '/warehouse/wholesaler-handover', load: pending, roles: ['WAREHOUSE'], label: 'nav.toWholesaler', navIcon: <Building2 />, railLabel: 'rail.toWholesaler' },

  // ── Moliya (2.7) ───────────────────────────────────────────────────────────
  { path: '/finance', load: pending, roles: ['FINANCE'], label: 'nav.elchiReconciliation', navIcon: <ArrowLeftRight /> },
  { path: '/finance/accounts', load: pending, roles: ['FINANCE'], label: 'nav.accounts', navIcon: <Landmark /> },
  { path: '/finance/withdrawals', load: pending, roles: ['FINANCE'], label: 'nav.withdrawals', navIcon: <Banknote /> },
  { path: '/finance/receipts', load: pending, roles: ['FINANCE'], label: 'nav.receipts', navIcon: <ReceiptText /> },

  // ── Optovik (2.8) — butun kabinet M2 (FE-23): menyu bandlari hozircha chiqmaydi ──
  { path: '/wholesaler', load: pending, roles: ['WHOLESALER'], label: 'nav.home' },

  // ── Admin va superadmin (2.4, 2.5) ─────────────────────────────────────────
  { path: '/admin/moderation', load: pending, roles: ADMIN_ROLES, label: 'nav.moderation', navIcon: <ListChecks />, navGroup: 'navGroup.work' },
  { path: '/admin/leads', load: pending, roles: ADMIN_ROLES, label: 'nav.leads', navIcon: <Inbox />, navGroup: 'navGroup.work' },
  { path: '/admin/orders', load: pending, roles: ADMIN_ROLES, label: 'nav.orders', navIcon: <ShoppingBag />, navGroup: 'navGroup.work' },
  { path: '/admin/products', load: pending, roles: ADMIN_ROLES, label: 'nav.products', navIcon: <Package />, navGroup: 'navGroup.catalog' },
  { path: '/admin/categories', load: () => import('../../pages/AdminCategoriesPage/AdminCategoriesPage'), roles: ADMIN_ROLES, label: 'adminNav.categories', navIcon: <FolderTree />, navGroup: 'navGroup.catalog' },
  { path: '/admin/inventory', load: () => import('../../pages/AdminInventoryPage/AdminInventoryPage'), roles: ADMIN_ROLES, label: 'nav.stock', navIcon: <Warehouse />, navGroup: 'navGroup.catalog' },
  { path: '/admin/sellers', load: pending, roles: ADMIN_ROLES, label: 'adminNav.sellerList', navIcon: <Store />, navGroup: 'navGroup.partners' },
  { path: '/admin/wholesalers', load: pending, roles: ADMIN_ROLES, label: 'nav.wholesalers', navIcon: <Building2 />, navGroup: 'navGroup.partners' },
  { path: '/admin/recordings', load: pending, roles: ADMIN_ROLES, label: 'nav.callRecordings', navIcon: <AudioLines />, navGroup: 'navGroup.control' },
  { path: '/admin/audit-logs', load: () => import('../../pages/AdminAuditPage/AdminAuditPage'), roles: ADMIN_ROLES, label: 'nav.auditJournal', navIcon: <History />, navGroup: 'navGroup.control' },
  { path: '/admin/users', load: () => import('../../pages/AdminUsersPage/AdminUsersPage'), roles: ADMIN_ROLES, label: 'adminNav.users', navIcon: <Users />, navGroup: 'navGroup.system' },
  { path: '/admin/users/new', load: () => import('../../pages/AdminUserCreatePage/AdminUserCreatePage'), roles: ADMIN_ROLES, label: 'adminNav.users', section: '/admin/users' },
  { path: '/admin/users/:userId', load: () => import('../../pages/AdminUserDetailPage/AdminUserDetailPage'), roles: ADMIN_ROLES, label: 'adminNav.users', section: '/admin/users' },
  { path: '/admin/integrations', load: pending, roles: ADMIN_ROLES, label: 'nav.integrations', navIcon: <Plug />, navGroup: 'navGroup.system' },
  { path: '/admin/settings', load: pending, roles: ADMIN_ROLES, label: 'nav.settings', navIcon: <Settings />, navGroup: 'navGroup.system' },
  { path: '/admin/profile', load: profile, roles: ADMIN_ROLES, label: 'nav.profile' },

  // ── Hamma rol: akkaunt sozlamalari (menyuda yo'q) ──────────────────────────
  { path: '/settings', load: () => import('../../pages/SettingsPage/SettingsPage'), roles: USER_ROLES, label: 'nav.accountSettings' },
];
