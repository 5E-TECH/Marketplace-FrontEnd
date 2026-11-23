import type { PickLine, PickTask } from '../model/fulfillmentTypes';

/**
 * Yig'ish qoidalari (OMB-2, OMB-4; ombor-yigish). Bosqich: TO_PICK (navbatda yoki yig'ilmoqda) → PICKED (qadoqqa) →
 * PACKED (topshirishga) → HANDED_OVER.
 */
export type TaskBadge = 'TO_PICK' | 'PICKING' | 'PICKED' | 'PACKED' | 'HANDED_OVER';

/** Boshlangan, lekin hali to'liq yig'ilmagan — «Yig'ilmoqda». */
export const isPicking = (task: PickTask) => task.status === 'TO_PICK' && task.pickedQty > 0;

export const taskBadge = (task: PickTask): TaskBadge => (isPicking(task) ? 'PICKING' : task.status === 'CANCELLED' ? 'TO_PICK' : task.status);

/** Joriy posilka: yig'ilayotgani, bo'lmasa navbatdagi birinchisi (ro'yxat tartibida — eskisi va kechikkani oldin). */
export function currentPickTask(items: readonly PickTask[]): PickTask | null {
  return items.find(isPicking) ?? items.find((task) => task.status === 'TO_PICK') ?? null;
}

/**
 * To'lqin hisobi: qadoqlangan / jami; «yig'ilmoqda» — joriy (ochiq) posilka, boshlanganlari va qadoq kutayotganlari
 * (dizaynda navbat boshidagi posilka ham «Yig'ilmoqda»). `active: false` — ertangi to'lqin: joriy posilka yo'q.
 */
export function waveStats(items: readonly PickTask[], { active = true }: { active?: boolean } = {}) {
  // Ertangi to'lqin faqat ko'rinadi — u yerda «yig'ilmoqda» posilka yo'q.
  const current = active ? currentPickTask(items) : null;
  const packed = items.filter((task) => task.status === 'PACKED').length;
  const picking = items.filter((task) => task === current || isPicking(task) || task.status === 'PICKED').length;
  return { total: items.length, packed, picking, queued: items.length - packed - picking, current };
}

/** Qadoqlanganlar: oxirgisi tepada. */
export const byPackedDesc = (a: PickTask, b: PickTask) => (b.packedAt ?? '').localeCompare(a.packedAt ?? '');

const codeOf = (line: Pick<PickLine, 'barcode' | 'sku'>) => line.barcode ?? line.sku;

/** Skanerlangan kod qaysi tovarniki (boshqa posilkalardan) — «Skanerlandi: Elektr choynak, B-02-2». */
export function lineByCode(items: readonly PickTask[], code: string): PickLine | null {
  for (const task of items) {
    const line = task.lines.find((item) => codeOf(item) === code);
    if (line) return line;
  }
  return null;
}

/** Hali yig'ilmagan birinchi qator — «Kerak». */
export const neededLine = (task: PickTask) => task.lines.find((line) => line.pickedQty < line.quantity) ?? null;

/** «Buxoro viloyati, Buxoro shahri» — taklif maydonlari kelsa. */
export const placeOf = (task: PickTask) => [task.regionName, task.districtName].filter(Boolean).join(', ') || null;

/** Og'irlik: qatorlar yig'indisi (kg), ma'lum bo'lmasa `null`. */
export function weightOf(task: PickTask): number | null {
  if (task.lines.some((line) => line.weightKg === null)) return null;
  return Math.round(task.lines.reduce((sum, line) => sum + (line.weightKg ?? 0) * line.quantity, 0) * 100) / 100;
}

/** «Simsiz quloqchinlar × 1» yoki «Simsiz quloqchinlar +1». */
export function goodsOf(task: PickTask): string {
  const [first, ...rest] = task.lines;
  if (!first) return task.orderNumber;
  return rest.length ? `${first.productName} +${rest.length}` : `${first.productName} × ${first.quantity}`;
}

/** Ro'yxat qatori: «Simsiz quloqchinlar» yoki «Simsiz quloqchinlar +1». */
export function productsOf(task: PickTask): string {
  const [first, ...rest] = task.lines;
  if (!first) return task.orderNumber;
  return rest.length ? `${first.productName} +${rest.length}` : first.productName;
}

/** Yig'ish varaqasi (hujjat-yigish-varaqasi) — karkassiz A4 sahifa, yangi tabda. */
export const pickSheetPath = (date: string) => `/warehouse/pick-sheet?date=${encodeURIComponent(date)}`;

export interface PickSheetGroup {
  /** Yacheyka + tovar: bitta yacheykadagi bir xil tovar — bitta qator. */
  key: string;
  cell: string | null;
  productName: string;
  code: string | null;
  /** Shu yacheykadan olinadigan jami dona. */
  quantity: number;
  /** `no` — varaqdagi tartib raqami (yacheykalar bo'ylab davomli). */
  orders: { no: number; taskId: string; orderNumber: string; customerName: string | null; quantity: number }[];
}

const byCell = (a: PickSheetGroup, b: PickSheetGroup) => {
  if (a.cell === b.cell) return a.productName.localeCompare(b.productName);
  if (!a.cell) return 1;
  if (!b.cell) return -1;
  return a.cell.localeCompare(b.cell, undefined, { numeric: true });
};

/**
 * Yig'ish varaqasi (hujjat-yigish-varaqasi): to'lqindagi hali yig'ilmagan dona — yacheyka tartibida (zona → javon →
 * qavat) va har biri qaysi buyurtma posilkasiga. Ertangi varaqqa faqat ertangi kun vazifalari (ro'yxat `pick_date <=`).
 */
export function pickSheet(items: readonly PickTask[], date: string, today: string) {
  const tasks = items.filter((task) => task.status === 'TO_PICK' && (date <= today ? task.pickDate <= date : task.pickDate === date));
  const groups = new Map<string, PickSheetGroup>();
  let pieces = 0;
  for (const task of tasks) {
    for (const line of task.lines) {
      const left = line.quantity - line.pickedQty;
      if (left <= 0) continue;
      const code = codeOf(line);
      const key = `${line.cell ?? ''}|${code ?? line.productName}`;
      const group = groups.get(key) ?? { key, cell: line.cell, productName: line.productName, code, quantity: 0, orders: [] };
      group.quantity += left;
      group.orders.push({ no: 0, taskId: task.taskId, orderNumber: task.orderNumber, customerName: task.customerName, quantity: left });
      groups.set(key, group);
      pieces += left;
    }
  }
  const sorted = [...groups.values()].sort(byCell);
  sorted.flatMap((group) => group.orders).forEach((order, index) => { order.no = index + 1; });
  const parcels = new Set(sorted.flatMap((group) => group.orders.map((order) => order.taskId))).size;
  const lastConfirmed = tasks.reduce<PickTask | null>((last, task) => (task.confirmedAt && (!last?.confirmedAt || task.confirmedAt > last.confirmedAt) ? task : last), null);
  return { groups: sorted, parcels, pieces, cells: new Set(sorted.map((group) => group.cell ?? '')).size, lastConfirmed };
}
