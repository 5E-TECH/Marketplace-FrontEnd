# FE-12: admin — mahsulot moderatsiyasi va offer sozlash — API taklifi

**Holat:** taklif. Asosiy endpointlar backend `dev` da bor (BE-07, BE-09, BE-11):
`GET/PATCH /admin/products[/{id}]`, `POST /admin/products/{id}/approve`, `POST …/reject {reason}`,
`POST …/hide {reason}`, `POST …/reactivate`, `GET …/pricing`, `POST …/price-decision`,
`GET …/price-decisions`, `GET/PUT /admin/offer-content/{productId}`, `GET /admin/inventory/stock?productId=`.
Bu hujjat dizayn ko‘rsatadigan, lekin backendda **yetishmayotgan** narsalarni taklif qiladi. Frontend shu
shakl bilan `src/mocks/handlers/admin.ts` orqali ishlaydi; yangi endpointlar `contract/pending-endpoints.json` da.

Dizayn (Panel 2): `admin-moderatsiya`, `admin-mahsulotlar`, `admin-mahsulot-karta`, `admin-offer`,
`admin-skript`, `admin-landing-mazmuni`, `admin-kategoriyalar`.
TZ: 6.10 ADM-1, 6.3 OPR-2, 6.1 SOT-9, DZ-05.

Karta bo‘yicha **yo‘q**: kreativ va sotuvchi sahifasi moderatsiyasi (sotuvchi kreativ va sahifa mazmunini
yuklamaydi — BE-27, LID-7 3-bosqich). Kreativni faqat admin yuklaydi (BE-08).

## 1. Mahsulot DTO siga maydonlar — `GET /admin/products`, `GET /admin/products/{id}`

`ProductDto` ga (hammasi ixtiyoriy; kelmasa frontend «—» yoki zaxira qiymat ko‘rsatadi):

```json
{
  "shop": { "id": "7", "name": "Namuna Savdo MChJ", "hasContract": true },
  "subtitle": "Bluetooth orqali ulanadi, quvvatlovchi g‘ilof bilan",
  "submittedAt": "2027-01-13T12:20:00.000Z",
  "statusChangedAt": "2027-01-06T05:00:00.000Z",
  "statusChangedBy": "Nodira Karimova",
  "blockReason": "Sertifikat muddati tugagan",
  "expiryTracked": false,
  "certificate": { "name": "Muvofiqlik sertifikati.pdf", "url": "https://…", "uploadedAt": "2027-01-13T12:18:00.000Z" }
}
```

- `shop` — ro‘yxatda backend `shop` relatsiyasini allaqachon qo‘shadi (`leftJoinAndSelect`); bitta mahsulotda
  ham kerak. `hasContract` — «Tizim tekshirdi: optovik shartnomasi imzolangan» (OPT-1; tasdiqda 409 baribir).
- `submittedAt` — moderatsiyaga yuborilgan vaqt (navbat «eng eskisi tepada», «Yuborilgan»). Kelmasa — `updatedAt`.
- `statusChangedAt`, `statusChangedBy` — joriy holatga o‘tgan vaqt va kim o‘tkazgani («06.01.2027 dan sotuvda»,
  «Sabab (Nodira K., 13.01.2027, 15:30)»). Kelmasa — `updatedAt`, ism ko‘rsatilmaydi.
- `blockReason` — `POST /hide {reason}` sababi; hozir faqat hodisaga ketadi, mahsulotda saqlanmaydi.
- `expiryTracked` — kategoriyadan meros «muddat kuzatiladi» (BAD, kosmetika, oziq-ovqat): moderatsiyadagi
  «Yaroqlilik muddati» bandi shunda qo‘llanadi.
- `certificate` — optovik yuklagan sertifikat (yopiq bucket — BE-30). Kelmasa — «Sertifikat yuklanmagan».

### Ro‘yxat elementiga qo‘shimcha (faqat `GET /admin/products`)

«Mahsulotlar va offerlar» jadvali bir so‘rovda chiqishi uchun (har qatorga alohida so‘rov emas):

```json
{
  "stock": { "available": 120, "onHand": 128, "reserved": 8, "incoming": 98 },
  "results": { "leads": 240, "epc": 1393, "approveRate": 50, "saleRate": 70 },
  "listPrice": { "customer": 262000, "recommended": false, "delivery": 30000, "deliveryMode": "PARTIAL" },
  "hasVideo": true
}
```

- `stock` — `null`: postavka yo‘q. `available = onHand − reserved`.
- `results` — hamma sotuvchi, sotuvga chiqqandan beri; `null` — statistika hali yo‘q. Bitta mahsulotda (offer
  yorlig‘idagi «Offer natijalari») to‘liq: `clicks`, `validLeads`, `confirmed`, `delivered`, `refused`, `inTransit`, `revenue`.
- `listPrice.customer` — tasdiqlangan narx yoki (tasdiqlanmagan bo‘lsa) tavsiya, `recommended: true`
  (`price` emas: `ProductDto.price` — eski storefront narxi).
- Filtrlar (`AdminProductsQueryDto` ga): `categoryId`, `cpaEnabled` («Kanal»), `attention=OUT_OF_STOCK|EXPIRY_SOON`.
  Holat yorliqlari soni — `GET /admin/moderation/summary` (2-bo‘lim).

## 2. Hisoblagichlar — `GET /admin/moderation/summary` (yangi, BE-27)

Moderatsiya tablari («Mahsulot 1 · Narx 3») va mahsulotlar yorliqlari soni:

```json
{
  "productsPending": 1,
  "pricesPending": 3,
  "byStatus": { "ALL": 7, "PENDING_REVIEW": 1, "ACTIVE": 4, "REJECTED": 1, "BLOCKED": 0, "DRAFT": 1 },
  "outOfStock": 1,
  "expirySoon": 0
}
```

`pricesPending` — narx qarori kutayotgan (tasdiqlangan narxi yo‘q yoki `approvalCurrent=false`) mahsulotlar;
Narx tabi mazmuni — FE-13 (`admin-narx`).

## 3. Mahsulot auditi — `GET /admin/audit?entityType=PRODUCT&entityId={id}`

«Audit — shu mahsulot» (moderatsiya pastida) va kartadagi «Oxirgi o‘zgarishlar» / «Audit» yorlig‘i uchun
mavjud audit ro‘yxatiga ikki filtr. Yozuvda `actorName` (yoki «Tizim») bo‘lsin. Hozir `forbidNonWhitelisted`
tufayli noma’lum parametr 400 beradi — backend qo‘shguncha bu blok xato qatorini ko‘rsatadi.

## 4. «Videosiz offer sotuvchiga chiqmaydi» (SOT-9, BE-27)

Sotuvchiga offer ochilish sharti (`isCpaAvailable`) ga **kamida bitta VIDEO kreativ** qo‘shilsin:
`GET /affiliate/offers` va `GET /landing/{code}` videosiz mahsulotni ko‘rsatmaydi.
Admin sababni o‘zi ko‘radi: offer yorlig‘idagi «Offer holati — ochilish shartlari: narx, video, qoldiq»
frontendda `ProductDto` (`approvedPrice`, `status`, `cpaEnabled`, `isBlocked`), kreativlar ro‘yxati va
qoldiqdan hisoblanadi (`src/features/adminProducts/lib/offerReadiness.ts`). Mock shu qoidaga amal qiladi.

## 5. Kreativlar — BE-08 (PR #127, merge kutilmoqda)

PR dagi shakl o‘zgarishsiz ishlatiladi:

- `GET /admin/products/{id}/creatives` → `CreativeDto[]` (`position` bo‘yicha);
- `POST /admin/products/{id}/creatives/upload {type, contentType, size}` → `{url, fields, objectKey, expiresAt, maxSize}`;
- fayl `url` ga `multipart/form-data` (avval `fields`, oxirida `file`) — `fetch`/XHR bilan (panel CSP `form-action 'self'`);
- `POST /admin/products/{id}/creatives {objectKey}` → `CreativeDto`;
- `DELETE /admin/products/{id}/creatives/{creativeId}` — taklif: tanada `{ reason }` (majburiy, audit `creative.delete`
  meta ga yoziladi; admin-offer «Kreativni o‘chirish» oynasi). Hozirgi handler tanani o‘qimaydi — sabab yo‘qolmaydi
  deb hisoblanmasin, backend qo‘shguncha faqat MSW auditida.

## 6. Sotuvchi haqini o‘zgartirish — mavjud API

«Haqni o‘zgartirish» oynasi yangi endpoint talab qilmaydi:

- qayta hisob — `GET /admin/products/{id}/pricing?price={approvedPrice}&affiliateFee={yangi}`
  (`evaluation.platformResult70`, `evaluation.status`);
- saqlash — `POST /admin/products/{id}/price-decision {price: approvedPrice, affiliateFee, reason}`:
  narx qarori tarixiga sabab bilan yoziladi, to‘q sariqda superadminga xabar ketadi, qizil — 400.
- Narx hali tasdiqlanmagan bo‘lsa haq narx bilan birga FE-13 da tanlanadi (tugma yopiq).
- Taklif: `PriceDecisionViewDto.decidedByName` — «Kuchga kirgan: 06.01.2027 · Nodira K.».

## 7. Suhbat skripti va sotuvchi sahifasi matnlari — mavjud API

`GET/PUT /admin/offer-content/{productId}`: `callScript` (bitta matn; operator lid kartasida qatorlarga
bo‘linib ko‘rinadi — `LeadCardDto.callScript`), `highlights[]` («afzalliklar», 2–3 qator), `boxContents[]`
(«Qutida»). Dizayndagi skript versiyalari, e’lon qilish, o‘zgaruvchilar va ruscha tab — kartada yo‘q.

## 8. Sotuvchi sahifasini oldindan ko‘rish (S1/S3) [taklif]

Storefront’da admin uchun ko‘rish yo‘li yo‘q (`/v/<s1|s3>/<kod>` tashqaridan 404, sahifa kodi talab qiladi).
Ishga tushishda oldindan ko‘rish admin panelining o‘zida chiziladi: `GET /admin/products/{id}` +
`GET /admin/offer-content/{id}` + kreativlar + narx hisobi. Keyin storefront `/preview/<productId>?v=s1|s3`
(admin sessiyasi bilan, piksel va formasiz) qo‘shsa — oyna iframe ga o‘tadi.

## 9. Kategoriyalar (admin-kategoriyalar)

Kategoriya javobiga (`CategoryTreeDto`) va `POST/PATCH /admin/categories` ga uch maydon:

```json
{ "slug": "uy-rozgor", "isBad": true, "expiryTracked": null }
```

- `slug` — ixtiyoriy; berilmasa hozirgidek nomdan (`toSlug`). Qolip `^[a-z0-9]+(-[a-z0-9]+)*$`, takror — 409.
  Ekran slugni nomdan backend bilan bir xil hosil qiladi va **faqat undan farq qilsa** yuboradi — shuning uchun
  hozirgi backend bilan oddiy qo‘shish/tahrir ishlaydi (`forbidNonWhitelisted`).
- `isBad` — toifa BAD: mahsulotlarida «Dori vositasi emas» yozuvi va moderatsiyadagi BAD bandi (TZ 8).
- `expiryTracked` — postavkada har partiya muddati yoziladi, 60 kundan kam qolgani sotuvga chiqmaydi (OMB-3).
- `null` — ota kategoriyadan meros, eng yuqorida — «yo‘q» (sukut). Ekran belgini meros qiymatiga teng bo‘lsa
  `null`, farq qilsa `true/false` qilib, **faqat o‘zgarganda** yuboradi.
- O‘chirish: hozir faqat ichki kategoriya tekshiriladi. Taklif — mahsuloti bor kategoriya ham 409 («Mahsuloti bor
  kategoriyani o‘chirib bo‘lmaydi»); ungacha ekran o‘zi tekshiradi va «Mahsulotlarni ochish» ni taklif qiladi.
- Ustama va yetkazish ko‘rinishi — mavjud `GET/PUT /admin/pricing/policy/categories/{id}` (o‘zgartirish — SUPERADMIN;
  ADMIN oynada ko‘radi, maydonlar yopiq). Tarif chegarasi — mavjud `GET /admin/pricing/elchi-tariffs` (amaldagisi).
- Parametrlar tarixi — mavjud `GET /admin/audit?action=pricing.policy.update` (meta: scope, before, after);
  kategoriya ekranda ajratiladi. `entityType/entityId` filtri (3-bo‘lim) qo‘shilsa — shu bilan so‘raladi.
- Dizayndagi «Kuchga kirish: belgilangan sana va vaqtdan» (rejalashtirilgan o‘zgarish) — backendda yo‘q, oynada
  ko‘rsatilmadi; o‘zgarish saqlangach darhol kuchga kiradi.

## Bu kartada qilinmagan (dizaynda bor)

- Moderatsiyadagi «Kreativ» va «Landing» tablari, «Kreativ pleyer», kreativni rad etish — karta olib tashlagan.
- «Narx» tabi mazmuni va narx kalkulyatori — FE-13. Mahsulot qo‘shish/tahrirlash formasi — FE-25.
- «Upsell juftligi» — FE-29 (M2). Skript versiyalari, ruscha skript, landing e’lon qilish oqimi — kartada yo‘q.
- Sukut shablon tanlovi («Standart»/«Video») — 12-savol qarori kutilmoqda.
- Kategoriyalar: «sayt: [sayt domeni — EQ-05]/katalog/…» qatori (domen qarori kutilmoqda), rejalashtirilgan
  «Kuchga kirish» sanasi (backendda versiya yo‘q). Global sukut qatoridagi ⚙ — «Sozlamalar» sahifasiga olib boradi
  (u hozir tayyorlanmoqda).
