# FE-08: operator ish joyi — API taklifi

**Holat:** taklif. Operator navbati endpointlarining asosiy qismi BE-25 shartnomasida bor
(`/operator/leads/next`, `/operator/leads/{id}`, `/result`, `/address`, `/quote`, `/state` (PUT),
`/queue-summary`, `/stats`). Bu hujjat faqat ish joyi ekrani uchun **yetishmayotgan** narsalarni
taklif qiladi. Frontend shu shakl bilan `src/mocks/handlers/operator.ts` orqali ishlaydi.
Yangi endpointlar `contract/pending-endpoints.json` ro‘yxatida turibdi. Backend ularni qo‘shgach,
`contract:check` ularni ro‘yxatdan o‘chirishni so‘raydi.

Qoidalar manbasi:

- TZ 6.3 OPR-1–5, 5-bo‘lim (1–9-qoidalar).
- Dizayn: `operator-karkas`, `operator-bosh`, `operator-lid-kartasi`, `operator-natija`,
  `operator-rejalashtirilgan`, `operator-mahsulot`, `operator-yordam`.

Barcha javoblar umumiy konvertda keladi: `{ statusCode, message, data }`. Xato javobi:
`{ statusCode, message, errorCode, requestId, ... }`.

## 1. Joriy holat — `GET /api/v1/operator/state` (yangi, BE-13)

Hozir faqat `PUT /operator/state` bor. Sahifa yangilanganda ekran holatni bilmaydi va «Oflayn»
deb ko‘rsatadi, «Bronlarim: 0/5» ham noto‘g‘ri chiqadi.

Javob — `200`, `OperatorStateDto` va bitta qo‘shimcha maydon:

```json
{ "state": "BREAK", "activeBookings": 2, "maxBookings": 5, "since": "2027-01-14T09:31:00.000Z" }
```

- `since` — shu holat boshlangan vaqt. Ekranda «Tanaffusdasiz · 6 daqiqa», «14:31 dan
  tanaffusda» (operator-bosh 3). `PUT` javobida ham shu maydon bo‘lsa yaxshi.
- Rol: `OPERATOR_LEAD`.

## 2. Mahsulot ma’lumoti — `GET /api/v1/operator/leads/{id}/product` (yangi, BE-13 / OPT-2)

Lid kartasidagi «Mahsulot ma’lumoti» paneli (operator-mahsulot). Faqat shu operatorga bron
qilingan yoki rejalashtirilgan lid uchun; boshqa lid — `404`.

```json
{
  "id": "501",
  "name": "Simsiz quloqchinlar",
  "category": "Elektronika",
  "imageUrl": null,
  "description": "Kundalik foydalanish uchun simsiz quloqchinlar…",
  "highlights": ["Telefonga Bluetooth orqali ulanadi", "Ixcham g‘ilofda saqlanadi"],
  "available": 120,
  "weightKg": 0.3,
  "contents": "quloqchinlar (juft), g‘ilof, kabel",
  "salePrice": 262000,
  "deliveryFee": { "CENTER": 30000, "ADDRESS": 50000 },
  "pageUrl": "https://elchi.uz/p/p3v9tx",
  "warning": null
}
```

- `salePrice` — lid sahifasidagi narx (lid kartasidagi `product.salePrice` bilan bir xil).
- `available` — omborda sotuvga bor dona. `0` bo‘lsa ekran «Tugagan — buyurtma tasdiqlanmaydi».
- `deliveryFee` — 1 dona uchun ikki yetkazish turi narxi, so‘m.
- `warning` — BAD, kosmetika va h.k. uchun operator aytishi shart bo‘lgan matn (TZ 7, 8). Yo‘q — `null`.
- `pageUrl` — mijoz ko‘rgan sotuvchi sahifasi. API lidida `null`.

## 3. Bugungi urinishlarim — `GET /api/v1/operator/attempts` (yangi, BE-13)

Ish joyi «Faol lid yo‘q» holatida jadval: «Bugungi urinishlarim · oxirgi 10 tasi, jami 38»
(operator-bosh). Parametrlar: `from`, `to` (Toshkent sanasi), `limit` (sukut 10).

```json
{
  "items": [
    { "at": "2027-01-14T09:33:00.000Z", "leadId": "L-1230", "customerName": "Dildora", "productName": "Oshxona tarozisi",
      "outcome": "REJECTED", "comment": null, "rejectReason": "NOT_NEEDED", "nextAttemptAt": null, "durationSeconds": 118 }
  ],
  "total": 38
}
```

- Faqat shu operatorning urinishlari, yangisi birinchi. `total` — `GET /operator/stats` dagi `attempts` bilan bir xil.
- `nextAttemptAt` — «Keyinroq qiling · ertaga 14:00», «Javob bermadi · 14:31» uchun.
- `durationSeconds` — suhbat davomiyligi; yozuv va tinglash FE-10 / BE-15 bilan. Hozir bo‘sh bo‘lishi mumkin.

## 4. Bronlar ro‘yxati — `GET /api/v1/operator/leads` (mavjud, maydon qo‘shish)

«Rejalashtirilgan qo‘ng‘iroqlar — bugun» qatori va «Rejalashtirilgan qo‘ng‘iroqlar» sahifasi
sababni ko‘rsatadi: «15:00 Bobur — O‘ylab ko‘radi «Turmush o‘rtog‘i bilan maslahatlashadi»».
`OperatorLeadListItemDto` ga ixtiyoriy maydonlar:

| Maydon | Tip | Ma’nosi |
|---|---|---|
| `lastOutcome` | `LeadOutcome \| null` | Oxirgi urinish natijasi (`CALL_LATER`, `THINKING`, …) |
| `lastComment` | `string \| null` | Oxirgi urinish izohi |
| `lastAttemptAt` | `string \| null` | Oxirgi urinish vaqti («10:20 dagi suhbat») |

Maydon bo‘lmasa ekran «—» ko‘rsatadi — buzilmaydi.

## 5. Navbat xulosasi — `GET /api/v1/operator/queue-summary` (mavjud, rol)

Shartnomada «nazoratchi» deb yozilgan. Operator ish joyi ham «Navbatda: 14 ta lid — 6 qayta
qo‘ng‘iroq, 8 yangi lid» qatorini ko‘rsatadi va navbat bo‘sh bo‘lsa «Keyingi lid» ni o‘chiradi
(operator-bosh 2). Taklif: `OPERATOR_LEAD` ham o‘qisin (`operators` ro‘yxatisiz yoki bo‘sh bilan).
`403` bo‘lsa ekran qatorni ko‘rsatmaydi va tugma serverning `LEAD_QUEUE_EMPTY` javobiga tayanadi.

## 6. Ekran tayangan mavjud qoidalar (tekshirish uchun)

- `POST /operator/leads/next` — `409 OPERATOR_ON_BREAK | OPERATOR_OFFLINE | BOOKING_LIMIT_REACHED`,
  `404 LEAD_QUEUE_EMPTY`. Navbat tartibi: avval operatorning o‘zi rejalashtirgan, vaqti kelgan
  qo‘ng‘iroqlar, keyin umumiy vaqti kelgan qayta qo‘ng‘iroqlar, keyin eng yangi lid
  (operator-rejalashtirilgan: «15:00 da lid sizning navbatingizda birinchi turadi»).
- `POST /operator/leads/{id}/result`:
  - `REJECTED` — `rejectReason` majburiy; `OTHER` da `comment` ham majburiy (dizayn).
  - `CALL_LATER` — `callbackAt` majburiy; `THINKING` — ixtiyoriy, bo‘lmasa ertasi kuni.
    Ekran 09:00–21:00 dan tashqari vaqtni o‘zi 09:00 ga suradi va surilgan vaqtni yuboradi.
  - `DUPLICATE` — `duplicateOfLeadId` shu raqamdagi, shu mahsulotdagi, 30 kun ichidagi lid.
  - `NO_ANSWER | BUSY | PHONE_OFF` — operator o‘zi tanlaydi (TEL-4 avtomatik aniqlash BE-15 bilan
    keyin). Javobdagi `nextAttemptAt` jadval bo‘yicha (15 daq → 1 soat → 3 soat → ertasi 10:00 →
    kuniga bir). 6 urinish yoki lid kelganidan 3 kun — `status: NO_CONTACT`.
    **Savol:** 3 kun lid kelgan vaqtdan hisoblanadimi yoki birinchi urinishdan? Ekran va mock —
    lid kelgan vaqtdan (operator-natija izohi [taklif]).
  - `CONFIRMED` — manzil tasdiqlanmagan bo‘lsa `400 ADDRESS_NOT_CONFIRMED`. FE-08 da ekran avval
    `PATCH /address` ni mijoz yozgan manzil bilan yuboradi (tasdiq), keyin natijani. Manzilni
    tahrirlash, miqdor va `quote` — FE-09.
- Bron muddati o‘tsa yoki operator tanaffus/oflaynga o‘tsa — bronlar navbat boshiga qaytadi;
  rejalashtirilgan qo‘ng‘iroq operatorda qoladi, vaqtidan 15 daqiqa o‘tsa — navbatga.
