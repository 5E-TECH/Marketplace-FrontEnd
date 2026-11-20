# FE-04: sotuvchi ro‘yxati, SMS bilan kirish va profil — API taklifi

**Holat:** taklif. Backendda hali yo‘q (BE-05 rollar, BE-06 SMS ro‘yxat, BE-23 pul yechish).
Frontend shu shakl bilan `src/mocks` orqali ishlaydi. Endpointlar
`contract/pending-endpoints.json` ro‘yxatida turibdi. Backend ularni qo‘shgach, `contract:check`
ularni ro‘yxatdan o‘chirishni so‘raydi.

Qoidalar manbasi:

- TZ 6.1 SOT-1.
- Dizayn: `sotuvchi-royxat`, `umumiy-kirish` §1, `sotuvchi-profil`, `sotuvchi-jshshir`, `sotuvchi-oferta`.

Barcha javoblar umumiy konvertda keladi: `{ statusCode, message, data }`. Xato javobi:
`{ statusCode, message, errorCode, requestId, ... }`.

## 1. SMS kod

### `POST /api/v1/auth/otp/send`

```json
{ "phone": "+998973152286", "purpose": "REGISTER" }
```

`purpose`: `REGISTER` (ro‘yxat) yoki `LOGIN` (sotuvchi va optovik kirishi).

Muvaffaqiyatli javob — `200`:

```json
{ "expiresIn": 300, "delivery": "SENT" }
```

- `expiresIn` — kod necha soniya amal qiladi. Mutlaq vaqt emas: foydalanuvchi soati noto‘g‘ri
  bo‘lsa ham «amal qiladi: 04:12» taymeri to‘g‘ri ishlaydi.
- `delivery: "DELAYED"` — SMS provayder javob bermadi. Kod yo‘qolmaydi, server uni o‘zi qayta
  yuboradi. Ekranda «SMS kechikmoqda» chiqadi.
- Qayta yuborilganda eski kod bekor bo‘ladi. Xato urinishlar hisobi saqlanadi.

| Holat | Status | `errorCode` | Qo‘shimcha |
|---|---|---|---|
| Operator kodi O‘zbekiston mobil operatori emas | 400 | `PHONE_OPERATOR_INVALID` | — |
| `REGISTER`: raqam allaqachon ro‘yxatda | 409 | `PHONE_ALREADY_REGISTERED` | — |
| `LOGIN`: hisob yo‘q yoki xodim (xodim parol bilan kiradi) | 404 | `ACCOUNT_NOT_FOUND` | — |
| 3 xatodan keyingi 15 daqiqalik blok | 423 | `OTP_BLOCKED` | `retryAfterSeconds` va `Retry-After` sarlavhasi |

> Ochiq savol: `LOGIN` da «hisob yo‘q» javobi raqam ro‘yxatda bor-yo‘qligini oshkor qiladi.
> Dizayn (umumiy-kirish 6-holat) buni ataylab ko‘rsatadi; xavfsizlik bo‘yicha qaror BE-06 da.

### `POST /api/v1/auth/otp/verify`

```json
{ "phone": "+998973152286", "code": "305918", "purpose": "REGISTER" }
```

Muvaffaqiyatli javob:

- `REGISTER` → `{ "registrationToken": "…" }`. Bu bir martalik token, oferta qadami uchun.
- `LOGIN` → `{ "accessToken": "…" }` va refresh cookie. Javob `/auth/login` bilan bir xil;
  cookie rejimida `accessToken: null`.

| Holat | Status | `errorCode` | Qo‘shimcha |
|---|---|---|---|
| Kod noto‘g‘ri | 400 | `OTP_INVALID` | `attemptsLeft` |
| Kod muddati o‘tgan yoki so‘ralmagan | 410 | `OTP_EXPIRED` | — |
| 3-xato kod — blok | 423 | `OTP_BLOCKED` | `retryAfterSeconds` |

## 2. Ro‘yxat

### `POST /api/v1/auth/register/affiliate`

```json
{ "registrationToken": "…", "offerVersion": "1.0", "consentVersion": "1.0" }
```

- Javob `201`: `{ "accessToken": "…" }` va refresh cookie. Sessiya darhol ochiladi.
- Ism so‘ralmaydi. Sotuvchi uni Profilda kiritadi.
- «Oferta qabul qilinmasa ro‘yxat tugamaydi»: versiyasiz so‘rov `400 OFFER_NOT_ACCEPTED` bilan
  rad etiladi.
- Server qabul qilingan versiya va vaqtni saqlaydi.
- Token eskirgan bo‘lsa: `410 REGISTRATION_EXPIRED`. Frontend telefon bosqichiga qaytadi.
- Yangi foydalanuvchi roli: `AFFILIATE` (BE-05).

## 3. Oferta va rozilik matni

### `GET /api/v1/legal/documents/{type}`

`type`: `affiliate-offer` yoki `personal-data-consent`.

```json
{
  "type": "affiliate-offer",
  "version": "1.0",
  "effectiveAt": null,
  "summary": [{ "term": "Haq", "text": "faqat mijoz to‘lagan buyurtma uchun, so‘mda yoziladi." }],
  "sections": [{ "id": "s1", "title": "1. Atamalar va taraflar", "body": "…" }]
}
```

- Matnni yurist tayyorlaydi (EQ-10).
- `effectiveAt: null` bo‘lsa, ekranda «e’lon qilinadi» chiqadi.
- Kirishsiz ham ochiladi, chunki ro‘yxat oferta qadamida o‘qiladi.

## 4. Sotuvchi profili

### `GET /api/v1/affiliate/profile` (faqat `AFFILIATE`)

```json
{
  "id": "U-1001", "firstName": "", "lastName": "", "phone": "+998973152286",
  "registeredAt": "2027-01-07T04:14:00Z", "lastLoginAt": "2027-01-07T04:14:00Z",
  "agreements": [
    { "type": "affiliate-offer", "version": "1.0", "acceptedAt": "2027-01-07T04:14:00Z", "current": true },
    { "type": "personal-data-consent", "version": "1.0", "acceptedAt": "2027-01-07T04:14:00Z", "current": true }
  ],
  "selfEmployed": {
    "status": "NOT_SUBMITTED", "pinflLast4": null, "activity": null,
    "submittedAt": null, "checkedAt": null, "reason": null, "comment": null, "documentName": null
  },
  "card": null
}
```

- `selfEmployed.status` qiymatlari:
  - `NOT_SUBMITTED` → `PENDING` → `VERIFIED` yoki `REJECTED`;
  - `VERIFIED` → `REVOKED` (soliq ro‘yxatida faol emas).
- To‘liq JShShIR va karta raqami qaytmaydi, faqat oxirgi 4 raqam.
- `card` (FE-07, BE-23): `{ "brand": "UZCARD" | "HUMO", "last4": "7731", "addedAt": "…" }`.
- `agreements` — barcha qabul qilingan versiyalar. «Versiyalar tarixi» shu ro‘yxatdan quriladi.

### `PATCH /api/v1/affiliate/profile`

```json
{ "firstName": "Jasur", "lastName": "Tursunov" }
```

- Javob — yangilangan profil.
- Ism tasdiqlangan maqom bilan o‘zgarsa, maqom qayta tekshiruvga tushadi: `PENDING`
  (sotuvchi-jshshir: «Ismim o‘zgarsa?»).
- `/auth/me` dagi `name` ham yangilanadi.

### `POST /api/v1/affiliate/self-employed/document` (multipart)

Maqom haqida ma’lumotnomani oldindan yuklash. Dizayn shuni talab qiladi: «hujjat yuklanmoqda —
yuborish yopiq», foiz, «Yuklashni to‘xtatish», «Yuklanmadi — aloqa uzildi · Qayta urinish».

- Maydon: `file` — PDF, JPG yoki PNG, 10 MB gacha.
- Javob `201`: `{ "documentId": "…", "name": "maqom-malumotnoma.pdf" }`.
- `413 FILE_TOO_LARGE`.
- Fayl yopiq: faqat sotuvchi va tekshiruvchi ko‘radi (BE-08 TC3).

### `GET /api/v1/affiliate/self-employed/document`

Yuborilgan ma’lumotnomaning o‘zi (blob, `Content-Disposition: inline`). Faqat egasi oladi.
Profil va JShShIR sahifasidagi «Ochish» tugmasi shu yerdan o‘qiydi.

### `POST /api/v1/affiliate/self-employed`

```json
{ "pinfl": "30101195600018", "documentId": "doc-1" }
```

Javob — `SelfEmployedInfo`, `status: "PENDING"`.

| Holat | Status | `errorCode` |
|---|---|---|
| JShShIR 14 raqam emas | 400 | `PINFL_INVALID` |
| `documentId` topilmadi yoki boshqa sotuvchiniki | 400 | `DOCUMENT_NOT_FOUND` |
| Ma’lumot hozir tekshirilmoqda | 409 | `ALREADY_PENDING` |

> BE-23 da hozir faqat admin `PUT /admin/finance/affiliates/{id}/self-employed` (boolean) bor.
> Sotuvchi tomoni (JShShIR, hujjat, sabab, izoh) taklif.
>
> Ochiq savollar:
> - ma’lumotnoma majburiymi — 23-qaror; frontendda hozir ixtiyoriy;
> - javob muddati — 23-qaror.

### `POST /api/v1/affiliate/agreements`

```json
{ "type": "affiliate-offer", "version": "1.1" }
```

- Ofertaning yangi versiyasini qabul qilish. Oldingi qator `current: false` bo‘ladi, yangisi
  vaqt bilan saqlanadi.
- Javob — yangilangan profil.
- Bosh sahifadagi «Sotuvchi ofertasi yangilandi» banneri «Oferta va roziliklar» ga olib boradi.
  U yerda «O‘qish va qabul qilish» tugmasi bor.
- Qabul qilinmaguncha kabinetni cheklash (`umumiy-oferta-qayta` taxtasi) FE-04 ga kirmaydi.

### `GET /api/v1/legal/documents/{type}/pdf`

Joriy versiya PDF fayli («PDF yuklab olish»):

- `Content-Disposition: attachment; filename="sotuvchi-ofertasi-1.0.pdf"`;
- PDF ni superadmin yuklaydi (hujjat-sotuvchi-oferta, «Hujjat qayerdan ochiladi»).

## 5. Bosh sahifa

### `GET /api/v1/affiliate/balance` (faqat `AFFILIATE`) — yangi, BE-23

«Mavjud» kartasi va menyu ostidagi cho‘ntak (sotuvchi-bosh; karkas-E 1.5):

```json
{ "available": 692500, "held": 302500 }
```

- `available` — yechib olsa bo‘ladigan pul, so‘m; qaytarilgan buyurtma haqi teskari yozilsa manfiy bo‘ladi;
- `held` — ushlab turilgan haq (Elchi posilka pulini o‘tkazguncha, odatda 1–2 kun), so‘m.

Pul yechish qoidalari (kuniga 1 marta, kamida 50 000 so‘m, 1% soliq) ekranda matn sifatida; yechish
so‘rovi va tarixi — FE-07.

Qolgan bloklar mavjud API dan:

- `GET /affiliate/stats?groupBy=DAY` — «Bugun» va 7 kun;
- `GET /affiliate/stats?groupBy=STREAM` — «Sahifalaringiz — bugun» va daromadning sahifalar bo‘yicha
  bo‘linishi;
- `GET /affiliate/leads?from=&to=` — «Bugun kelgan N lid» holatlari;
- `GET /affiliate/streams`;
- `GET /notifications`.

Raqamlar FE-06 «Statistika» bilan bir xil bo‘lishi uchun ikkala sahifa bir xil so‘rov va
`src/features/affiliate/lib/statsSummary.ts` hisobidan foydalanadi (FE-04 TC3).

Backenddan talab:

- bir kunning `STREAM` qatorlari yig‘indisi shu kunning `DAY` qatoriga teng bo‘lsin;
- `/affiliate/leads` dagi bir kunlik lidlar soni `DAY` qatoridagi `leads` ga teng bo‘lsin.
