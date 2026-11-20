/**
 * Sotuvchi balansi (taklif — docs/api-taklif/fe-04-sotuvchi.md, 5-bo'lim; backendda BE-23, ekran FE-07).
 * Alohida faylda: mock (`src/mocks`) ham ishlatadi, u esa `httpClient` ni import qilmasligi kerak.
 */
export interface AffiliateBalance {
  /** Yechib olsa bo'ladigan pul, so'm. Qaytarilgan buyurtma haqi teskari yozilsa manfiy bo'ladi. */
  available: number;
  /** Ushlab turilgan haq: Elchi posilka pulini o'tkazguncha (odatda 1–2 kun), so'm. */
  held: number;
}

/** Pul yechish qoidalari (TZ 2.5, 5-qoida; SOT-7): kuniga 1 marta, kamida 50 000 so'm, 1% soliq. */
export const MIN_PAYOUT = 50_000;
