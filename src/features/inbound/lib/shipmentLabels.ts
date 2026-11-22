import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { addDays, tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import type { InboundShipment, ShipmentActor } from '../model/inboundTypes';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** «Kiritdi»: «Optovik · kabinetda» yoki «Nodira K. · admin, nomidan». */
export function authorLabel(t: Translate, actor: ShipmentActor): { name: string; sub: string } {
  if (actor.role === 'WHOLESALER') return { name: t('inb.author.wholesaler'), sub: t('inb.author.cabinet') };
  return { name: shortPersonName(actor.name), sub: t(actor.role === 'WAREHOUSE' ? 'inb.author.warehouse' : 'inb.author.admin') };
}

/** Kelish sanasi ostidagi izoh: «qabul 09:40», «keldi, hozir sanalmoqda», «bugun keladi», «ertaga». */
export function arrivalNote(t: Translate, shipment: InboundShipment, today = tashkentDate()): string | null {
  if (shipment.completedAt) {
    const at = Date.parse(shipment.completedAt);
    return tashkentDate(at) === today ? t('inb.arrival.received', { time: tashkentClock(at) }) : null;
  }
  if (shipment.status === 'CANCELLED') return null;
  if (shipment.receivingStartedAt) return t('inb.arrival.counting');
  if (shipment.expectedAt === today) return t('inb.arrival.today');
  if (shipment.expectedAt === addDays(today, 1)) return t('inb.arrival.tomorrow');
  return null;
}

/** Qabul akti (hujjat-qabul-akti): A4 sahifa, ekrandan PDF — yangi tabda ochiladi. */
export const inboundActPath = (id: string) => `/inbound-acts/${encodeURIComponent(id)}`;

/** Admin: postavka tafsiloti (admin-postavka holatlar 4, telefonda R8 — to'liq sahifa). */
export const adminShipmentPath = (id: string) => `/admin/wholesalers/shipments/${encodeURIComponent(id)}`;
