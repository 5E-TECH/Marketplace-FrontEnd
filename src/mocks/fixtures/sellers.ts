/**
 * Sotuvchilar hisoblari (FE-15 «Sotuvchilar» yorlig'i, admin-foydalanuvchilar.holatlar «Tablar»): dizayn namunasidagi
 * sotuvchilar va qo'shimcha hisoblar (jami 41 ta — sahifalash ko'rinsin). Backend `/admin/users` da yo'q maydonlar
 * (oxirgi kirish, sahifalar soni, jazo, blok sanasi) — taklif: docs/api-taklif/fe-15-admin-foydalanuvchilar.md §11.
 * Kirish hisoblari `users.ts` da (bu fayl uni import qilmaydi).
 */

export interface MockSellerInfo {
  lastLoginAt: string | null;
  /** Sahifa (oqim) kodlari — qidiruv «sahifa kodi» bo'yicha ham. */
  codes: string[];
  sanction: { kind: 'WARNING' | 'HOLD'; since: string } | null;
  /** `evidence` — dalil (taklif fe-15 §15: «Hisobingiz bloklangan» sahifasi). */
  block: { at: string; by: string; reason: string | null; evidence?: string | null } | null;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const hoursAgo = (hours: number) => minutesAgo(Math.round(hours * 60));
const daysAgo = (days: number) => hoursAgo(days * 24);

const info = (lastLoginAt: string | null, codes: string[], extra: Partial<Pick<MockSellerInfo, 'sanction' | 'block'>> = {}): MockSellerInfo => ({
  lastLoginAt, codes, sanction: extra.sanction ?? null, block: extra.block ?? null,
});

/** Tayyor sotuvchilar (users.ts `MOCK_USERS`) va orderStore `MOCK_AFFILIATES` (FE-26 lid filtrlari). */
const KNOWN: Record<string, MockSellerInfo> = {
  'U-0001': info(minutesAgo(20), ['k7m2qa', 'p3v9tx']),
  'U-0010': info(daysAgo(3), ['s4n8yd']),
  'U-0101': info(hoursAgo(3.6), ['d2h6va']),
  'U-0102': info(hoursAgo(4.8), ['r9c4mn']),
  'U-0103': info(hoursAgo(6.2), ['v5d8nq']),
  'U-0104': info(daysAgo(4), ['h2q7vz']),
};

/** Kirish hisobi `users.ts` da; bu — dizayn namunasidagi va qo'shimcha sotuvchilar (telefon 9 raqam → hisob). */
interface ExtraSeller { digits: string; id: string; firstName: string; lastName: string; seller: MockSellerInfo; blocked: boolean }

const named: ExtraSeller[] = [
  { digits: '930000105', id: 'U-0105', firstName: 'Bekzod', lastName: 'Mahmudov', blocked: false, seller: info(minutesAgo(58), ['b6t3ke']) },
  { digits: '930000106', id: 'U-0106', firstName: 'Ilhom', lastName: 'Bakirov', blocked: false, seller: info(hoursAgo(3), ['i8w2rp'], { sanction: { kind: 'HOLD', since: daysAgo(1) } }) },
  { digits: '930000107', id: 'U-0107', firstName: 'Diyor', lastName: 'Saidov', blocked: false, seller: info(hoursAgo(4.2), ['y3m9lc'], { sanction: { kind: 'WARNING', since: daysAgo(4) } }) },
  { digits: '930000108', id: 'U-0108', firstName: 'Akmal', lastName: 'Rasulov', blocked: false, seller: info(hoursAgo(21), ['a5j7qn']) },
  { digits: '930000109', id: 'U-0109', firstName: 'Zafar', lastName: 'Qosimov', blocked: false, seller: info(hoursAgo(22), ['z1k4ub']) },
  {
    digits: '930000110', id: 'U-0110', firstName: 'Bobur', lastName: 'Yoqubov', blocked: true,
    seller: info(hoursAgo(47), ['o9e5wx'], { block: { at: hoursAgo(45), by: 'Akmal Sobirov', reason: 'Aldovli reklama', evidence: 'Kreativ o‘chirildi' } }),
  },
];

const FIRST = ['Aziz', 'Barno', 'Dilshod', 'Elyor', 'Gulchehra', 'Hasan', 'Iroda', 'Jahongir', 'Komila', 'Laziz', 'Madina', 'Nodir', 'Oybek', 'Parvina', 'Rustam', 'Saida', 'Tohir', 'Umid', 'Vohid', 'Xurshid', 'Yulduz', 'Zarina', 'Anvar', 'Behruz', 'Charos', 'Doniyor', 'Erkin', 'Farrux', 'G‘ayrat'];
const LAST = ['Abdullayev', 'Boboyeva', 'Valiyev', 'G‘aniyev', 'Davronov', 'Ergasheva', 'Jo‘rayev', 'Zokirov', 'Islomova', 'Karimov', 'Latipova', 'Murodov', 'Nazarov', 'Olimova', 'Po‘latov', 'Qodirova', 'Rahimov', 'Sobirova', 'Toshev', 'Usmonov', 'Fayzullayev', 'Xolmatov', 'Shukurova', 'Ochilov', 'Yusupov', 'Hamroyev', 'Ne’matova', 'Sultonov', 'Mirzayev'];

const generated: ExtraSeller[] = FIRST.map((firstName, index) => {
  const number = 201 + index;
  return {
    digits: `9300${number.toString().padStart(5, '0')}`,
    id: `U-0${number.toString()}`,
    firstName,
    lastName: LAST[index] ?? 'Aliyev',
    blocked: false,
    seller: info(index === FIRST.length - 1 ? null : daysAgo(3 + index * 1.1), index % 4 === 0 ? [`g${number.toString()}a`, `g${number.toString()}b`] : [`g${number.toString()}a`]),
  };
});

export const EXTRA_SELLER_ACCOUNTS: readonly ExtraSeller[] = [...named, ...generated];

/** Har seed'da yangi nusxa — blok va jazo mock'da o'zgaradi. */
export function sellerInfoFor(id: string): MockSellerInfo | undefined {
  const seed = KNOWN[id] ?? EXTRA_SELLER_ACCOUNTS.find((item) => item.id === id)?.seller;
  return seed ? structuredClone(seed) : undefined;
}
