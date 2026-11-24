# FE-09: operator — manzil tasdig'i, buyurtma formasi va mijozga aytiladigan summa — API va taklif

**Holat:** frontend BE-13 / BE-38 / BE-09 ga ulangan (backend `dev` da, kontraktda bor). Summa faqat serverdan — ekran
hisoblamaydi. Mock — `src/mocks/handlers/operator.ts` (yetkazish formulasi backend `pricing.service.ts` `quoteFor` dan,
`src/mocks/pricingCalculator.ts` orqali). Quyida: ishlatilgan endpointlar (§1) va backendda **yo'q**, ekran kutayotgan
maydonlar — taklif (§2–§6). Taklif maydoni kelmasa, ekran ishlayveradi (pastda — nima bo'lishi).

Dizayn (Panel 1): `operator-buyurtma-formasi` (+ `.planshet`, `.mobil`, `.holatlar` 28 kadr), `operator-lid-kartasi`.
TZ: 6.3 OPR-4, 6.5 BUY-4, 2.4; DZ-03, DZ-12.

## 1. Ishlatilgan endpointlar

| Amal | Yo'l | Izoh |
|---|---|---|
| Lid kartasi | `GET /operator/leads/{id}` | `address` (`confirmedAt`, `editedByOperator`), `price`, `history`, `blacklistRejections` |
| Summa | `POST /operator/leads/{id}/quote {quantity, whereDeliver}` | 200; `null` — narx hisoblanmadi (mijozga summa aytilmaydi) |
| Manzil tasdig'i | `PATCH /operator/leads/{id}/address {regionSoato, districtSoato, addressLine, whereDeliver}` | saqlash — tasdiq; javob — yangilangan karta; xato — 400 `details[].field` |
| Natija | `POST /operator/leads/{id}/result {outcome: CONFIRMED, quantity, comment?}` | manzil tasdiqlanmagan — 400 `ADDRESS_NOT_CONFIRMED` |
| Qoldiq | `GET /operator/leads/{id}/product` → `available` | fe-08 taklifi (backendda `OperatorLeadProductDto` bor) |
| Tumanlar | `GET /regions/tree` | BE-38 |

«Buyurtmani tasdiqlash» bitta tugma: manzil tasdiqlanmagan yoki operator o'zgartirgan bo'lsa avval `PATCH address`,
keyin `POST result` (dizayn: «Buyurtmani tasdiqlash» manzil tasdig'i ham [taklif; 204-savol]). Formadagi «Ko'cha, uy» va
«Xonadon, mo'ljal» bitta `addressLine` bo'lib yuboriladi («Turkiston ko'chasi, 27-uy, 3-xonadon»).

## 2. Narx obyekti — qo'shimcha maydonlar (`LeadPriceDto`, karta `price` va `quote` javobi)

| Maydon | Nima uchun | Kelmasa |
|---|---|---|
| `deliveryMode` (`SEPARATE`/`PARTIAL`/`FREE`) | forma sarlavhasidagi «qisman rejim» belgisi, kartadagi «(qisman rejim)» | belgi ko'rinmaydi |
| `weightGrams` | posilkaning jami og'irligi — «Jami og'irlik 4.2 kg», pastda «Yetkazish (markazgacha, 4.2 kg)» | og'irlik `product.weightKg × miqdor` dan |
| `deliveryOptions` `{CENTER, ADDRESS}` | shu miqdor uchun ikkala tur: «Markazgacha 30 000 so'm · eshikkacha 50 000 so'm» | 1 donada `product.deliveryFee` dan, ko'p donada — faqat tanlangani |
| `deliveryFormula` `{base, extraKg, perExtraKg, baseWeightGrams}` | «40 000 + 3 × 4 000 = 52 000»; miqdor oshganda «52 000 → 76 000 (40 000 + 9 × 4 000)» (BUY-4) | 3 kg gacha izohi |
| `prepayment` `{amount, method}` | qora ro'yxatdagi mijoz: «Oldindan 30 000 so'm», usul (TZ 7; 6-savol) | «Oldindan» qatori yo'q |

Qoida: `deliveryFee = base + extraKg × perExtraKg`. Alohida rejimda `base` — Elchi bazasi (markaz 40 000, eshik
60 000), `extraKg` — 3 kg dan ortiq butun kg. Qisman rejimda `base` — bir donaning ko'rinadigan yetkazishi, `extraKg` —
jami og'irlik oshgani uchun qo'shilgan kg (backend `visibleUnit + (tariff − unitTariff)`). Bepulda — `null`.

## 3. Lid tarixi — manzil tuzatishi (`LeadHistoryEntryDto.changes`)

Backend tuzatilgan har maydonning eski va yangi qiymatini `lead_history` da saqlaydi, lekin kartaga faqat izoh
(«Operator manzilni tuzatdi») beradi. TC5 («lid tarixida eski va yangi tuman») uchun taklif — bitta `PATCH` uchun bitta
yozuv:

```json
{ "at": "2027-01-14T09:37:00.000Z", "fromStatus": "BOOKED", "toStatus": "BOOKED", "actor": "Dilnoza R.",
  "note": "Operator manzilni tuzatdi",
  "changes": [{ "field": "district", "from": "Qo‘qon shahri", "to": "Farg‘ona shahri" }] }
```

`field` — `region`, `district`, `addressLine`, `whereDeliver` (`CENTER`/`ADDRESS`); viloyat va tuman — **nomi** bilan.
O'zgarishsiz tasdiq — `changes: []` (kartada ko'rsatilmaydi, buyurtma tasdig'i o'zi aytadi — 20-kadr). `changes` kelmasa,
yozuv «{izoh} — {kim}» bo'lib ko'rinadi.

## 4. Tasdiq javobi va band qilish

- `LeadResultAcceptedDto.stockAvailable` — band qilingandan keyin omborda qolgan dona («Simsiz quloqchinlar band
  qilindi: mavjud 119»). Kelmasa — `product.available − miqdor`.
- Band qilinmasa (oxirgi dona boshqa buyurtmaga ketdi, miqdor qoldiqdan ko'p) — **sinxron** `409 OUT_OF_STOCK`
  `{available}`: buyurtma yaratilmaydi, lid «Bronda» qoladi (19-kadr). Hozir backendda buyurtma asinxron yaratiladi va
  xato keyin hodisa bilan keladi (`order.create-failed` → lid navbatga qaytadi) — operator ekranda ko'rmaydi.

## 5. Tumanda eshikkacha yetkazish yo'q (`/regions/tree`)

Tuman obyektiga `doorDelivery: false` — Elchi u yerda eshikkacha bormaydi: «Eshikkacha» qulf, izoh «Elchi Pochta bu
tumanda eshikkacha olib bormaydi» (4-kadr; ro'yxat — 40-savol, EQ-06). `PATCH address` bunday tumanga `ADDRESS` ni
400 `details[].field = whereDeliver` bilan rad etadi.

## 6. Jo'natish kuni (OMB-4)

14:00 gacha tasdiqlangan buyurtma o'sha kuni, keyin — ertasi kuni jo'natiladi; formada va «Buyurtma yaratildi» kartasida
ko'rsatiladi (21, 22-kadrlar [taklif]). Ekran Toshkent vaqti bo'yicha hisoblaydi; backend boshqa qoida (dam olish
kunlari) qo'shsa — buyurtma javobida `shipDate` bersin.
