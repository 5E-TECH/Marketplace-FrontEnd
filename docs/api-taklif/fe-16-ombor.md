# FE-16: ombor — postavka e’loni va qabuli, partiya va muddat — API va taklif

**Holat:** frontend BE-17 ga moslangan — backend PR #132 (`feat/be-17-ombor-qabul` → `dev`, ochiq, 2026-11-22).
PR merge bo‘lguncha yo‘llar `contract/pending-endpoints.json` da («BE-17 (PR #132)»); merge bo‘lgach
`npm run api:sync` va ro‘yxatdan o‘chiriladi. Mock — `src/mocks/handlers/warehouse.ts` (PR qoidalari bilan).
Quyida: frontend ishlatadigan BE-17 shakli (§1–3) va backendda **yetishmayotgan** narsalar — taklif (§4).

Dizayn (Panel 2): `ombor-qabul`, `admin-postavka`, `ombor-muddat`, `ombor-qoldiq`; hujjat — `hujjat-qabul-akti`.
TZ: 6.6 OMB-1, OMB-2, OMB-3; DZ-06.

## 1. Postavka — `admin/inventory/shipments` (ADMIN, WAREHOUSE, SUPERADMIN)

| Amal | Yo‘l | Izoh |
|---|---|---|
| Ro‘yxat | `GET /admin/inventory/shipments?status&wholesalerId&page&limit` | bitta holat; yangisi tepada |
| Karta | `GET /admin/inventory/shipments/{id}` | |
| E’lon | `POST /admin/inventory/shipments` | `{ wholesalerId, expectedAt, note?, items: [{ productId, quantity }] }` — bitta postavka, bir nechta qator; mahsulot shu optovikniki, CPA, faol |
| Qabul | `POST /admin/inventory/shipments/{id}/receive` | **faqat WAREHOUSE, SUPERADMIN**; hamma qator bitta so‘rovda (§2) |
| Akt | `GET /admin/inventory/shipments/{id}/act.pdf` | qabuldan keyin; optovikka qo‘lda |
| «Yo‘lda» | `POST /admin/inventory/shipments/{id}/in-transit` | backendda [taklif — ixtiyoriy]; frontend hozir ishlatmaydi (kim belgilaydi — TZ’da yo‘q) |

`InboundShipmentDto`: `id, number, wholesalerId, status (DECLARED | IN_TRANSIT | RECEIVED | DISCREPANCY), expectedAt,
note, declaredBy, receivedBy, receivedAt, receiveComment, items[], createdAt`.
Qator: `id, productId, productName, variantId, sku, barcode, declaredQty, receivedQty (brak bilan), defectiveQty,
batch, expiryDate, cell`. Frontendda «Qabul» = `receivedQty − defectiveQty` (yaroqli), «Brak» = `defectiveQty`.

Bekor qilish backendda yo‘q — frontendda ham olib tashlandi (dizayndagi «Bekor qilindi» holati ko‘rsatilmaydi).

## 2. Qabul

Skan API yo‘q: omborchi skanerlagan har dona **shu qurilmaning brauzerida** sanaladi (qoralama: sanoq, jurnal,
partiya, yacheyka, izoh — `localStorage`), «Qabulni yakunlash» bitta so‘rov yuboradi:

```json
POST /admin/inventory/shipments/114/receive
{ "items": [{ "itemId": "1141", "receivedQty": 100, "defectiveQty": 2, "batch": "P-0114-1", "expiryDate": "2027-03-05", "cell": "B-02-1" }],
  "comment": "2 ta qutida korpus singan" }
```

- Takroriy skan (1 s ichida bir xil kod — oraliq TZ’da yo‘q, taklif), noma’lum kod, boshqa postavka kodi, brak rejimi,
  oxirgi skanni bekor qilish — brauzerda; serverga faqat yakuniy sonlar boradi.
- Aloqa uzilsa sanoq davom etadi; yakunlash aloqa tiklangach (javob — o‘sha natija, takror yuborish xavfsiz).
- Yacheyka majburiy (`^[A-Za-z0-9][A-Za-z0-9-]{0,31}$`): qoldiqdagi `cell` dan olinadi, yo‘q bo‘lsa yakunlashda so‘raladi.
- Farq yoki brak bo‘lsa — `DISCREPANCY`, aks holda `RECEIVED` (server hisoblaydi).

## 3. Partiya va qoldiq

- `GET /admin/inventory/lots?state=ALL|BLOCKED|SELLABLE` → `StockLotDto[]`: `id, variantId, sku, productName, batch,
  expiryDate, sellableUntil (muddat − 60 kun), quantity, blocked`. Holat brauzerda: muddati o‘tgan → sotuvdan
  chiqarilgan (`blocked`) → sotuvda.
- Hisobdan chiqarish: `POST /admin/inventory/adjust { variantId, delta: −n, reason, lotId, idempotencyKey }` — sabab va
  izoh `reason` ga yoziladi (audit). Optovikka qaytarish — FE-18 (ombor-optovikka), bu kartada yo‘q.
- `GET /admin/inventory/stock` (BE-16 + BE-17 `cell`, `blocked`): `available` ga sotuvdan chiqqan partiyalar kirmaydi (TC4).

## 4. Taklif — backendda yetishmayotgan narsalar

Frontend bularsiz ham ishlaydi (maydon kelmasa — zaxira matn yoki ko‘rsatilmaydi), lekin dizayn to‘liq chiqishi uchun:

1. **Omborchiga o‘qish ruxsati:** `GET /admin/wholesalers` va `GET /admin/products?shopId=` hozir faqat ADMIN, SUPERADMIN.
   Omborchi «Arizasiz postavka»ni ochadi (BE-17: WAREHOUSE e’lon qiladi), lekin optovik va mahsulotni tanlay olmaydi.
   Taklif: shu ikki GET ga `WAREHOUSE` (yoki alohida `GET /warehouse/wholesalers` — optovik va CPA mahsulotlari).
   Shu ruxsat bo‘lmasa omborchi aktida optovik STIR va shartnoma ham chiqmaydi (server PDF da bor).
2. **Nomlar** (`InboundShipmentDto`): `wholesalerName`, `declaredByName`, `declaredByRole`, `receivedByName` — ro‘yxatdagi
   «Mahsulot · optovik», «Kiritdi» ustuni va aktdagi «Qabul qildi». Hozir faqat ID.
3. **Ro‘yxat filtrlari:** bir nechta holat (`status=DECLARED,IN_TRANSIT`), `search`, `expectedFrom/To`, `receivedOn`,
   holatlar soni (`counts`). Hozir frontend har holatga alohida so‘rov yuboradi va qidiruv/«Kelish»ni yuklangan
   100 ta ichida qiladi.
4. **Qatorda `expiryTracked`** (BAD, kosmetika, oziq-ovqat — kategoriyadan): muddat birinchi skanda so‘ralishi uchun.
   Kelmasa — partiya va muddat ixtiyoriy («Partiya va muddat» tugmasi).
5. **Qoldiq qatorida:** `shopName`, `barcode`, brak soni, bugungi/ertangi band (FE-17) — «Qoldiq → Ro‘yxat» ustunlari.
6. **Partiyada:** optovik va xabar yuborilgan vaqt (`notifiedAt`) — «Muddat» bo‘limidagi «Xabarlar».
