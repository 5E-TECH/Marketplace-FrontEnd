# FE-13: admin — narx kalkulyatori va narxni tasdiqlash (4 holat) — API va taklif

**Holat:** frontend BE-09 ga ulangan (backend `dev` da, kontraktda bor). Hisob faqat serverda — ekran natijani
ko'rsatadi. Mock — `src/mocks/pricingCalculator.ts` (backend `libs/common/src/pricing/price-calculator.ts` nusxasi,
aniq butun arifmetika) va `src/mocks/handlers/admin.ts`. Quyida: ishlatilgan BE-09 shakli (§1) va backendda
**yo'q**, frontend kutayotgan narsalar — taklif (§2–§5). Taklif maydoni kelmasa, ekran ishlayveradi.

Dizayn (Panel 2): `admin-narx` (+ `.planshet`, `.mobil`, `.holatlar`). Joyi: «Moderatsiya → Narx» tabi va mahsulot
kartasidagi «Narx» yorlig'i. TZ: 2.1–2.6, 6.13 NRX-1…NRX-6, NRX-13.

## 1. Ishlatilgan BE-09 endpointlari

| Amal | Yo'l | Izoh |
|---|---|---|
| Hisob | `GET /admin/products/{id}/pricing?price&affiliateFee` | kiritilgan narx va yangi haq bilan qayta hisob (300 ms kechikish bilan) |
| Tasdiqlash | `POST /admin/products/{id}/price-decision {price, affiliateFee?, reason?}` | qizil — 400; to'q sariq sababsiz — 400; to'q sariqda superadminga xabar |
| Bozor narxi | `POST /admin/products/{id}/market-check {competitorTotal}` | MOS/QIMMAT, eng yuqori bazaviy narx; summa mahsulotda saqlanadi |
| Yetkazish rejimi | `PUT /admin/products/{id}/price-policy {deliveryMode}` | mahsulot darajasi; `null` — yuqori qatlamdan |
| Rad etish | `POST /admin/products/{id}/reject {reason}` | narx rad etilsa mahsulot sotuvga chiqmaydi (BE-07) |
| Navbat soni | `GET /admin/moderation/summary` → `pricesPending` | BE-27 |

Hisob javobidan ekran oladi: `params` (K₇₀, K₁₀₀, M, soliq, to'lov, qo'ng'iroq markazi, koeffitsient, reklama
xarajati, rejim), `calculation` (tavsiya, zararsizlik, qat'iy chegara, `yellowFrom`, `orangeFrom`, yetkazish,
ulush), `evaluation` (holat, taqsimot, natija 70% va 100%, sotuvchi natijasi, `safeAffiliateFee`).

## 2. Narx navbati — `GET /admin/moderation/prices` (taklif)

Admin ro'yxatida narx navbati filtri ham, tavsiya narx ham yo'q. Taklif — `pricesPending` bilan bir xil qoida
(CPA, bloklanmagan, `PENDING_REVIEW` yoki `ACTIVE`, `approvalCurrent = false`):

```json
{ "items": [{ "productId": "511", "name": "…", "shopName": "Namuna Savdo MChJ", "basePrice": 140000,
  "recommended": 262000, "deliveryMode": "PARTIAL", "queuedAt": "2027-01-06T05:05:00.000Z" }], "total": 1 }
```

Tartib — `queuedAt` (navbatga tushgan: yuborilgan yoki asosi o'zgargan vaqt) bo'yicha, eskisi oldin.

## 3. Bozor narxi: manba va oldindan ko'rish (taklif)

- `POST …/market-check` body ga `source?: string` (≤ 300; «Qayerda ko'rildi») — javobda va hisobda qaytadi.
  Hozirgi backend uni rad etadi (`forbidNonWhitelisted` → 400, `details[].field = "source"`) — frontend summani
  manbasiz qayta yuboradi, summa saqlanadi; manba backend qo'shgandan keyin saqlana boshlaydi.
- `preview: true` — natijani **saqlamasdan** qaytaradi («Bozor narxini kiritish» oynasida summa yozilayotganda).
  Hozirgi backend noma'lum maydonni rad etadi (400) — oyna natijasiz ishlaydi, «Saqlash» ishlaydi.

## 4. Hisob javobiga qo'shimcha maydonlar (taklif)

| Maydon | Nima uchun |
|---|---|
| `params.deliveryModeSource` (`GLOBAL`/`CATEGORY`/`PRODUCT`) | «qisman, global sozlamadan» |
| `calculation.recommendedBaseExact` | formula izohi «… / 0.9415 = 250 120 → 1 000 gacha yuqoriga» |
| `evaluation.maxAffiliateFee` | qizil holat: «sotuvchi haqi ko'pi bilan 44 226 so'm bo'lishi kerak» (`safeAffiliateFee` reklama xarajatidan kam bo'lsa `null`) |
| `modes[]` `{mode, goodsPrice, delivery, customerTotal, platformResult70, platformResult100}` | uch rejim jadvali va sariq holatdagi «tavsiya narxda → shu narxda» |
| `market` `{competitorTotal, ourTotal, verdict, maxBasePrice, source, checkedAt}` | sahifa ochilganda oxirgi bozor tekshiruvi (hozir faqat `marketTotal` saqlanadi) |

## 5. Audit

Ekran `GET /admin/audit?entityType=Product&entityId=` yozuvlarini vaqt bo'yicha ko'rsatadi (fe-12 §3). Narx
uchun kutilgan `action` lar: `price.recommended`, `price.decision` (`meta.status`), `price.market`,
`pricing.policy.update` (mahsulot darajasi), `product.basePrice`.
