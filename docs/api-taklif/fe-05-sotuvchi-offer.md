# FE-05: offerlar, offer tafsiloti va sotuvchi sahifasi — API taklifi

**Holat:** taklif. Offerlar ro‘yxati, sahifa yaratish, ro‘yxat va sozlamalar BE-25 shartnomasida bor
(`GET /affiliate/offers`, `POST /affiliate/streams`, `GET /affiliate/streams`,
`PATCH /affiliate/streams/{id}`). Bu hujjat faqat dizayn ko‘rsatadigan, lekin backendda
**yetishmayotgan** narsalarni taklif qiladi. Frontend shu shakl bilan `src/mocks/handlers/affiliate.ts`
orqali ishlaydi. Yangi endpointlar `contract/pending-endpoints.json` ro‘yxatida.

Dizayn: `sotuvchi-offerlar`, `sotuvchi-offer`, `sotuvchi-sahifalarim`, `sotuvchi-sahifa-sozlash`.
TZ: 6.1 SOT-2, SOT-3, SOT-9, NRX-4, 2.4, 2.5.

## 1. Ro‘yxat elementiga ikki maydon — `GET /api/v1/affiliate/offers`

Offer kartasida mahsulot nomi ostida kategoriya, narx ostida «+ yetkazish 30 000 so‘m» turadi.
`AffiliateOfferDto` ga:

```json
{ "categoryName": "Elektronika", "centerDeliveryFee": 30000 }
```

- `centerDeliveryFee` — markazgacha yetkazish (bepul rejimda `0`). Kelmasa, frontend qatorni chiqarmaydi.
- Qidiruv nom **va kategoriya** bo‘yicha bo‘lsin («Qidiruv mahsulot nomi va kategoriyasi bo‘yicha»).

## 2. Offer tafsiloti — `GET /api/v1/affiliate/offers/{productId}` (yangi)

«Offer tafsiloti va kreativlar» sahifasi. Sotuvchiga ko‘rinadigan offer (ADM-1 dan o‘tgan) bo‘lmasa — `404`.
Javob — `AffiliateOfferDto` maydonlari va quyidagilar:

```json
{
  "categoryName": "Elektronika",
  "subtitle": "Bluetooth orqali ulanadi, quvvatlovchi g‘ilof bilan",
  "description": "Kundalik foydalanish uchun simsiz quloqchinlar…",
  "boxContents": "quloqchinlar (juft), quvvatlovchi g‘ilof, quvvat kabeli.",
  "weightKg": 0.3,
  "deliveryMode": "PARTIAL",
  "centerDeliveryFee": 30000,
  "addressDeliveryFee": 50000,
  "isBad": false,
  "state": "OPEN",
  "stoppedAt": null,
  "stopReason": null,
  "onSaleSince": "2026-10-01",
  "results": { "clicks": 3000, "leads": 240, "validLeads": 204, "confirmed": 102, "delivered": 63, "refused": 27, "revenue": 4180000 },
  "priceSplit": { "recommended": 251000, "wholesale": 140000, "affiliateFee": 65000, "callCenter": 12000, "platform": 34000, "deliveryInPrice": 10000 },
  "creatives": [
    { "id": "5010", "type": "VIDEO", "url": "https://…/5010.mp4", "caption": "asosiy", "processing": false, "approvedAt": "2027-01-06T09:00:00.000Z" }
  ]
}
```

- `deliveryMode` — `SEPARATE` (alohida) | `PARTIAL` (qisman, sukut) | `FREE` (bepul); TZ 2.4, 13-qaror.
- `state` — `OPEN` | `OUT_OF_STOCK` (qoldiq 0, SOT-2) | `STOPPED` (admin to‘xtatgan, `stoppedAt`, `stopReason`) |
  `SHORT_EXPIRY` (yaroqlilik muddati 60 kundan kam, OMB-3). `OPEN` dan boshqasida «Sahifa yaratish» yopiq
  va sababi yoziladi; `POST /affiliate/streams` ham `409` qaytaradi (hozir qoldiq 0 da shunday).
- `results` — **hamma sotuvchilar** bo‘yicha, sotuvga chiqqandan beri; `revenue` — EPC surati
  (EPC = `revenue / clicks`). Lid yig‘ilmagan bo‘lsa — `null` («Statistika hali yo‘q»).
- `priceSplit` — «Narx qanday bo‘linadi» (taqsimot ochiq). `deliveryInPrice` — qisman rejimda
  yetkazishning tovar narxiga qo‘shilgan qismi.
- `creatives[].caption` — admin yozgan qisqa izoh («asosiy», «g‘ilofda»); `processing` — video hali
  tayyorlanmoqda (ko‘rish va yuklab olish yopiq).
- Rol: `AFFILIATE`.

## 3. Kreativlar arxivi — `GET /api/v1/affiliate/offers/{productId}/creatives/archive` (yangi)

«Hammasini yuklab olish»: offerning tasdiqlangan kreativlari bitta ZIP da.
Javob — `200`, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="…-kreativlar.zip"`.

## Frontendda qoladigan hisob

- Haq: `affiliateFee + floor((salePrice − approvedPrice) × 85 / 100)` — backend `order-commission.ts`
  bilan bir xil (85% — sozlama emas, 11-qaror).
- Narx chegarasi: `approvedPrice ≤ salePrice ≤ maxSalePrice` — server ham tekshiradi (`400`).

## Bu kartada qilinmagan (dizaynda bor)

- QR kod — karta: «QR olib tashlandi: SOT-3 faqat tayyor havola so‘raydi».
- Sozlamada postback URL, siri va Meta CAPI tokeni — karta TC6: «Sozlashda postback URL maydoni yo‘q»
  (FE-28 / BE-14).
- Landing domenini tanlash — EQ-05 qarori va API yo‘q.
- Sahifani o‘zi to‘xtatish yoki arxivlash — dizaynda [taklif], TZ da yo‘q.
