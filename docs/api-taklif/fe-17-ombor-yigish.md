# FE-17: ombor — yig‘ish, qadoq, yorliq va Elchi’ga topshirish — API va taklif

**Holat:** frontend BE-19 ga moslangan (backend `dev` da, kontraktda bor). Mock — `src/mocks/handlers/fulfillment.ts`
(BE-19 qoidalari bilan). Quyida: frontend ishlatadigan BE-19 shakli (§1–4) va backendda **yetishmayotgan** narsalar —
taklif (§5). Taklif maydonlari kelmasa, frontend tegishli blokni yashiradi — hech narsa buzilmaydi.

Dizayn (Panel 2): `ombor-yigish`, `ombor-qadoq`, `ombor-topshirish`, `umumiy-chop-etish`; hujjatlar —
`hujjat-yigish-varaqasi`, `hujjat-posilka-yorligi`, `hujjat-topshirish-akti`. TZ: 6.6 OMB-2, OMB-4, OMB-5.

## 1. Yig‘ish ro‘yxati — `GET /warehouse/pick-list?date=YYYY-MM-DD` (ADMIN, WAREHOUSE, SUPERADMIN)

- 14:00 qoidasi backendda: 14:00 (Toshkent) gacha tasdiqlangan — o‘sha kun, keyin — ertasi (`pickDate`).
- Ro‘yxat `pick_date <= date`: oldingi kunlardan qolganlar ham (`overdue: true`); holatlar `TO_PICK`, `PICKED`,
  `PACKED`; bekor qilingan va topshirilganlar chiqmaydi. Tartib — `pickDate`, vazifa ID.
- Frontend: «Bugun» — `date=bugun`; «Ertaga» — `date=ertaga` va faqat `pickDate = ertaga` (bugungilar ham kelgani uchun).
- Qator: `taskId, orderId, orderNumber, status, pickDate, overdue, quantity, pickedQty, lines[], parcel{elchiState,
  shipmentId, labelReady, error}`. `lines` bo‘lmagan eski javobda birinchi qator ildizdagi `productName, sku, barcode`
  maydonlaridan olinadi.

## 2. Yig‘ish skani — `POST /warehouse/tasks/{id}/scan { code }`

Har skan — bitta so‘rov (shtrix-kod yoki SKU). `409 WRONG_ITEM` — boshqa tovar yoki bu tovardan hamma dona yig‘ilgan:
frontend qizil blok ko‘rsatadi (server xabari + «Skanerlandi / Kerak»), «Qadoqqa o‘tish» yopiq qoladi (TC1).
Hamma dona yig‘ilgach holat `PICKED` — «Qadoqqa o‘tish» ochiladi.

## 3. Qadoq va yorliq

- `GET /warehouse/orders/{orderId}/label` — PDF 100×60: Elchi trek, QR (`qr_code_token`), tasdiqlangan manzil (TC2).
  Elchi posilkasi yo‘q — `409`; frontend «Yorliq hali tayyor emas» va Elchi xatosini (`parcel.error`) ko‘rsatadi.
- «Qadoqlandi» (`POST /warehouse/tasks/{id}/pack`) — yorliq shu ekranda chop etilgach yoki PDF yuklab olingach ochiladi.

## 4. Elchi’ga topshirish — `POST /warehouse/handover-acts { qrTokens[] }`

Skan API yo‘q: QR lar **shu qurilmaning brauzerida** yig‘iladi (`localStorage` `elchi.handover.draft` — sahifa
yangilansa ham saqlanadi). Takror, qadoqlanmagan, tovar shtrix-kodi va noma’lum QR aktga kirmaydi; «Aktni yakunlash» —
bitta so‘rov. Javobdagi `parcelCount` = ekrandagi son (TC3). Hammasi yoki hech biri: `409` da sabablar
(«Akt tuzilmadi: L-…: qadoqlanmagan …») ko‘rsatiladi, qoralama o‘chmaydi. O‘sha to‘plam qayta yuborilsa — o‘sha akt.
PDF — `GET /warehouse/handover-acts/{id}/pdf`, karta — `GET /warehouse/handover-acts/{id}`.

## 5. Taklif — backendda yo‘q

### 5.1. `pick-list` qatoriga maydonlar (dizayn: ombor-yigish, ombor-qadoq, ombor-topshirish, yig‘ish varaqasi)

| Maydon | Tip | Nima uchun |
|---|---|---|
| `lines[].cell` | string \| null | yacheyka (A-01-3): yig‘ish jadvali va varaqa yacheyka tartibida |
| `lines[].weightKg` | number \| null | kutilgan og‘irlik (tortish bloki) |
| `customerName` | string \| null | posilka sarlavhasi «L-1276 · Rustam», varaqadagi «Mijoz» ustuni |
| `regionName`, `districtName` | string \| null | tasdiqlangan manzil qisqa ko‘rinishi |
| `deliveryMode` | `CENTER` \| `DOOR` | «markazgacha / eshikkacha» |
| `codAmount` | number \| null | olganda to‘lanadigan summa (qadoq, akt) |
| `confirmedAt` | ISO | «tasdiqlandi 13:55», varaqadagi «Oxirgi tasdiq» |
| `packedAt` | ISO \| null | «Bugun qadoqlangan» ro‘yxati, yorliqni qayta chop etish |
| `parcel.qrCodeToken` | string \| null | topshirishda har QR skanga **darhol** javob (qaysi buyurtma, takror, qadoqlanmagan) |

`parcel.qrCodeToken` kelmasa, topshirishda skanerlangan kod tekshiruvsiz aktga qo‘shiladi va server yakunlashda
tekshiradi (409 sabablari bilan) — ishlaydi, lekin xato kech bilinadi.

### 5.2. Oldingi aktlar — `GET /warehouse/handover-acts?page&limit`

`{ items: HandoverActDto[], total, page, limit }`, yangisi tepada. Dizayndagi «Oldingi aktlar» bloki; javob 404/403
bo‘lsa yoki bo‘sh bo‘lsa, blok yashiriladi. `contract/pending-endpoints.json` da («BE-19 taklif»).

### 5.3. Qolgan savollar (TZ’da yo‘q)

- «Kamomad» (tovar yetmasa) va «Yacheykaga qaytarish» amallari — varaqda qo‘lda yoziladi, API yo‘q.
- Elchi olib ketish vaqti (EQ-06), tarozi va yorliq printeri modeli, og‘irlik chegarasi (EQ-07) — joy egallovchi.
- Yorliqni qayta chop etish auditi (kim, qachon) — backendda yozilmaydi.
- Yig‘ish varaqasi — frontendda `pick-list` dan quriladi (`/warehouse/pick-sheet?date=`, A4, brauzer chop etishi);
  faqat hali yig‘ilmagan dona, yacheyka tartibida. Server PDF kerak bo‘lsa — alohida taklif.
