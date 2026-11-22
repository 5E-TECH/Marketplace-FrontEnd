import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { addDays, tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import type { InboundShipment, ShipmentPerson } from '../model/inboundTypes';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Ro'yxat sarlavhasi: birinchi mahsulot, qolganlari soni bilan — «Simsiz quloqchinlar +1». */
export function shipmentTitle(t: Translate, shipment: InboundShipment): string {
  const [first, ...rest] = shipment.items;
  if (!first) return shipment.number;
  return rest.length ? t('inb.moreProducts', { name: first.productName, count: rest.length }) : first.productName;
}

/** Optovik nomi (taklif maydoni) — kelmasa «Optovik #7». */
export const wholesalerLabel = (t: Translate, shipment: InboundShipment) =>
  shipment.wholesaler.name ?? t('inb.wholesalerId', { id: shipment.wholesaler.id });

/** «Kiritdi»: «Optovik · kabinetda» yoki «Nodira K. · admin, nomidan». Ism kelmasa — rol bilan. */
export function authorLabel(t: Translate, person: ShipmentPerson): { name: string; sub: string } {
  if (person.role === 'WHOLESALER') return { name: t('inb.author.wholesaler'), sub: t('inb.author.cabinet') };
  return {
    name: person.name ? shortPersonName(person.name) : t('inb.author.staff'),
    sub: t(person.role === 'WAREHOUSE' ? 'inb.author.warehouse' : 'inb.author.admin'),
  };
}

/** Xodimning qisqa ismi; backend ism bermasa — «—». */
export const personName = (person: ShipmentPerson | null) => (person?.name ? shortPersonName(person.name) : '—');

/** Kelish sanasi ostidagi izoh: «qabul 09:40», «bugun keladi», «ertaga». */
export function arrivalNote(t: Translate, shipment: InboundShipment, today = tashkentDate()): string | null {
  if (shipment.receivedAt) {
    const at = Date.parse(shipment.receivedAt);
    return tashkentDate(at) === today ? t('inb.arrival.received', { time: tashkentClock(at) }) : null;
  }
  if (shipment.expectedAt === today) return t('inb.arrival.today');
  if (shipment.expectedAt === addDays(today, 1)) return t('inb.arrival.tomorrow');
  return null;
}

/** Qabul akti (hujjat-qabul-akti): A4 sahifa — yangi tabda ochiladi. */
export const inboundActPath = (id: string) => `/inbound-acts/${encodeURIComponent(id)}`;

/** Admin: postavka tafsiloti (admin-postavka holatlar 4, telefonda R8 — to'liq sahifa). */
export const adminShipmentPath = (id: string) => `/admin/wholesalers/shipments/${encodeURIComponent(id)}`;
