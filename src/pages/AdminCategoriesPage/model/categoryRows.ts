import type { AdminProductListItem, ProductStatus } from '../../../features/adminProducts/model/adminProductTypes';
import type { PolicyLayer, PolicyValues } from '../../../features/categories/api/categoryPolicyApi';
import type { Category } from '../../../features/categories/model/categoryTypes';

/** Qiymat qayerdan: kategoriyaning o'zida, ota kategoriyadan, global sukutdan yoki sukut (admin-kategoriyalar 2). */
export type Source = 'own' | 'parent' | 'global' | 'default';

export interface Resolved<T> {
  value: T;
  source: Source;
  /** Ota kategoriyadan bo'lsa — qaysi biridan («Go‘zallik va salomatlik»dan). */
  from?: string;
}

export interface ProductCounts {
  /** Shu kategoriyaning o'zida. */
  total: number;
  active: number;
  rejected: number;
  /** Ichki kategoriyalarda. */
  inside: number;
}

export interface CategoryRow {
  category: Category;
  depth: number;
  parent: Category | null;
  hasChildren: boolean;
  expanded: boolean;
  /** Qo'shnilar orasidagi o'rni (0 dan) va qo'shnilar soni — «sayt menyusida N-o'rin», tartib tugmalari. */
  position: number;
  siblings: number;
  markup: Resolved<number | null>;
  mode: Resolved<PolicyValues['deliveryMode']>;
  center: Resolved<number | null>;
  door: Resolved<number | null>;
  bad: Resolved<boolean>;
  expiry: Resolved<boolean>;
  products: ProductCounts;
}

export type FlagKey = 'isBad' | 'expiryTracked';

export function flatten(items: readonly Category[]): Category[] {
  return items.flatMap((item) => [item, ...flatten(item.children)]);
}

/** Ota zanjiri (yuqoridan pastga) — `parentId` dan boshlab. */
export function parentChain(flat: readonly Category[], parentId: string | null): Category[] {
  const chain: Category[] = [];
  for (let current = flat.find((item) => item.id === parentId); current; current = flat.find((item) => item.id === current?.parentId)) {
    if (chain.includes(current)) break;
    chain.unshift(current);
  }
  return chain;
}

/** BAD va muddat: o'zida → ota zanjiri (eng yaqini) → sukut (yo'q). */
export function resolveFlag(own: boolean | null | undefined, parents: readonly Category[], key: FlagKey): Resolved<boolean> {
  if (typeof own === 'boolean') return { value: own, source: 'own' };
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const value = parents[index][key];
    if (typeof value === 'boolean') return { value, source: 'parent', from: parents[index].name };
  }
  return { value: false, source: 'default' };
}

/** Narx parametri: kategoriya qatlami yoki global (backend `paramsFor`: global → kategoriya → mahsulot; ota kategoriya qatnashmaydi). */
const pick = <T,>(own: T | null | undefined, global: T | null | undefined): Resolved<T | null> =>
  own !== null && own !== undefined ? { value: own, source: 'own' } : { value: global ?? null, source: 'global' };

/** Tartib qoralamasi: kategoriya → qo'shnilar orasidagi yangi o'rni (saqlanguncha faqat ekranda). */
export type OrderDraft = Readonly<Record<string, number>>;

export function applyOrder(items: readonly Category[], draft: OrderDraft | null): Category[] {
  if (!draft) return [...items];
  return items
    .map((item, index) => ({ item, position: draft[item.id] ?? index }))
    .sort((a, b) => a.position - b.position)
    .map(({ item }) => ({ ...item, children: applyOrder(item.children, draft) }));
}

/** Qo'shnilar (shu ota ichida) ko'rinish tartibida. */
export function siblingsOf(tree: readonly Category[], parentId: string | null): Category[] {
  if (parentId === null) return [...tree];
  return flatten(tree).find((item) => item.id === parentId)?.children ?? [];
}

/** `category` ni qo'shnilar ichida `to` o'rniga ko'chiradi — guruhning hamma o'rinlari qoralamaga yoziladi. */
export function moveInDraft(tree: readonly Category[], draft: OrderDraft, category: Category, to: number): OrderDraft {
  const siblings = siblingsOf(tree, category.parentId).filter((item) => item.id !== category.id);
  siblings.splice(Math.max(0, Math.min(to, siblings.length)), 0, category);
  return { ...draft, ...Object.fromEntries(siblings.map((item, index) => [item.id, index])) };
}

const matches = (category: Category, search: string) => `${category.name} ${category.slug}`.toLowerCase().includes(search);

/**
 * Ko'rinadigan qatorlar: daraxt chuqurligi bilan; qidiruvda — mos kelgan va ularning otalari (hammasi ochiq).
 * `tree` — ko'rinish tartibida (tartib qoralamasi qo'llangan).
 */
export function categoryRows(
  tree: readonly Category[],
  { collapsed, search, policies, global, products }: {
    collapsed: ReadonlySet<string>;
    search: string;
    policies: ReadonlyMap<string, PolicyLayer | undefined>;
    global: PolicyLayer | undefined;
    products: readonly AdminProductListItem[];
  },
): CategoryRow[] {
  const query = search.trim().toLowerCase();
  const visible = (category: Category): boolean => !query || matches(category, query) || category.children.some(visible);
  const direct = (id: string) => products.filter((product) => product.categoryId === id);
  const inside = (category: Category): number => category.children.reduce((sum, child) => sum + direct(child.id).length + inside(child), 0);
  const rows: CategoryRow[] = [];

  const walk = (items: readonly Category[], parents: Category[]) => {
    items.forEach((category, position) => {
      if (!visible(category)) return;
      const layer = policies.get(category.id);
      const own = direct(category.id);
      const expanded = Boolean(query) || !collapsed.has(category.id);
      rows.push({
        category,
        depth: parents.length,
        parent: parents.at(-1) ?? null,
        hasChildren: category.children.length > 0,
        expanded,
        position,
        siblings: items.length,
        markup: pick(layer?.markupCapPercent, global?.markupCapPercent),
        mode: pick(layer?.deliveryMode, global?.deliveryMode),
        center: pick(layer?.visibleCenter, global?.visibleCenter),
        door: pick(layer?.visibleAddress, global?.visibleAddress),
        bad: resolveFlag(category.isBad, parents, 'isBad'),
        expiry: resolveFlag(category.expiryTracked, parents, 'expiryTracked'),
        products: {
          total: own.length,
          active: own.filter((product) => product.status === 'ACTIVE' && !product.isBlocked).length,
          rejected: own.filter((product) => product.status === 'REJECTED').length,
          inside: inside(category),
        },
      });
      if (expanded) walk(category.children, [...parents, category]);
    });
  };
  walk(tree, []);
  return rows;
}

const STATUS_ORDER: ProductStatus[] = ['ACTIVE', 'PENDING_REVIEW', 'REJECTED', 'DRAFT', 'ARCHIVED'];
const statusRank = (product: AdminProductListItem) => (product.isBlocked ? STATUS_ORDER.length : Math.max(0, STATUS_ORDER.indexOf(product.status)));

/** Mahsulotlar: faol → ko'rib chiqilmoqda → rad etilgan → qoralama → arxiv → to'xtatilgan. */
export const byStatus = (products: readonly AdminProductListItem[]) => [...products].sort((a, b) => statusRank(a) - statusRank(b));
