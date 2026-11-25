# FE-26: admin va nazoratchi — lidlar, buyurtmalar, buyurtma kartasi va bekor qilish — API va taklif

**Holat:** frontend BE-13 / BE-18 / BE-35 / BE-42 ga ulangan (backend `dev` 1ae3397). Mock — `src/mocks/handlers/leadOrders.ts`
va `src/mocks/orderStore.ts`. Quyida: ishlatilgan endpointlar (§1) va backendda **yo'q**, ekran kutayotgan endpoint va
maydonlar — taklif (§2–). Taklif parametri backend rad etsa (`forbidNonWhitelisted` → 400 `details[].field`), so'rov
ularsiz qayta yuboriladi (`src/shared/api/optionalParams.ts`) — ekran backend biladigan filtrlar bilan ishlayveradi.

Dizayn: Panel 2 — `admin-lidlar`, `admin-lid-karta`, `admin-buyurtmalar`, `admin-buyurtma-karta`; Panel 1 —
`nazoratchi-buyurtmalar`, `operator-buyurtmalarim` (har biri `.planshet`, `.mobil`, `.holatlar` bilan).

## 1. Ishlatilgan endpointlar

| Amal | Yo'l | Izoh |
|---|---|---|
| Lidlar ro'yxati | `GET /admin/leads` (ADMIN, SUPERVISOR) | `page, limit, status, productId, operatorId, affiliateId, from, to`; telefon niqoblangan |
| Lid kartasi | `GET /admin/leads/{id}` | `LeadCardDto` |
| Qayta ochish | `POST /admin/leads/{id}/reopen {reason}` (ADMIN) | faqat «Rad etildi»; lid «Yangi» bo'lib qaytadi (urinishlar 0); 409 `LEAD_NOT_REJECTED`, `ACTIVE_LEAD_EXISTS` |
| O'tkazish | `POST /supervisor/leads/{id}/transfer {operatorId, reason?}` (SUPERVISOR, ADMIN) | faqat «Ishda» operatorga; lid uning broniga (chegara 5); 409 `OPERATOR_ON_BREAK`, `OPERATOR_OFFLINE`, `BOOKING_LIMIT_REACHED`, `LEAD_NOT_TRANSFERABLE` |
| Operatorlar | `GET /operator/queue-summary` | o'tkazish oynasi: `operators[] {operatorId, name, state, activeBookings}` |
| Buyurtmalar | `GET /admin/orders` (ADMIN, SUPERVISOR) | `status, source, dateFrom, dateTo, page` |
| Buyurtma kartasi | `GET /admin/orders/{id}` | `sellerOrders[].items[].priceSnapshot`, `lead.statusHistory`; `customerPhone` — faqat admin |
| Bekor qilish | `POST /admin/orders/{id}/cancel`, `POST /operator/orders/{id}/cancel` `{reason}` | Elchi'ga topshirilgunga qadar; band tovar darhol bo'shaydi; keyin — 409 `INVALID_STATE` |
| Qaytarish so'rovi | `POST /admin/orders/{id}/returns` | backend `dev` da bor, `contract/openapi.json` eskirgan (`api:sync` kerak) |
| Yorliq | `GET /admin/orders/{id}/label` | PDF |

## 2. Lidlar ro'yxati — taklif parametrlari va maydonlar (`GET /admin/leads`)

| Parametr | Nima uchun | Backend rad etsa |
|---|---|---|
| `tab` (`ACTIVE`, `CONFIRMED`, `REJECTED`, `CLOSED`, `REVIEW`) | holat yorliqlari: «Ishda» = Yangi + Bronda + Qayta qo'ng'iroq, «Yopilgan» = Yaroqsiz + Dublikat + Aloqa bo'lmadi | bitta holatli tab — `status` bilan; qolganlari — joriy sahifa filtrlanadi |
| `search` | «Lid, ism, telefon yoki sahifa kodi»; telefon (≥ 7 raqam) bo'yicha — faqat admin, audit jurnaliga | qidiruv qo'llanmaydi |
| `source` | «Manba» filtri (faqat admin) | qo'llanmaydi |
| `sort` (`createdAt`, `price`, `attempts`, `-` bilan kamayish) | «Narx», «Urinish», «Keldi» ustunlari | sukut tartibi |

| Javob maydoni | Nima uchun | Kelmasa |
|---|---|---|
| `counts {ALL, ACTIVE, CONFIRMED, REJECTED, CLOSED, REVIEW}` | yorliqlardagi sonlar (filtrlar bo'yicha); nazoratchiga `REVIEW` yo'q | sonlar ko'rinmaydi |
| `review {count, streamCode, affiliateName, from, to}` | «7 ta ariza tekshiruvda — navbatga tushmagan» banneri (BE-35, faqat admin) | banner yo'q |
| item: `productId, regionName, streamCode, salePrice, attemptsCount, operatorId` | Mijoz (viloyat), «Sahifa · sotuvchi», Narx, Urinish ustunlari | «—» |
| item: `closedNote` | holat ostidagi sabab: «Qimmat», «→ L-1163 · asosiy lid», «6 urinish · 13.01, 10:01» | sabab yo'q |
| item: `rejectedAt` | qayta ochish oynasi: «Rad etildi — bugun, 13:02 · Shohruh M.» | qator yo'q |
| item: `callbackAt` | o'tkazish oynasi: «qo'ng'iroq 15:20»; «O'tkazilgandan keyin — 15:20 va 17:30 saqlanadi» | vaqt yo'q |
| item: `queuePosition` | o'tkazish oynasi: «navbatda 8-o'rin · 1 daq» | «navbatda · 1 daq» |
| item: `statusAt` | real vaqt: holat o'zgargan qator ajratiladi, «hozirgina · 14:38» | belgi yo'q |
| item: `inReview` | «Tekshiruvda» arizasi (o'tkazib bo'lmaydi) | — |

## 3. O'tkazish — rejalashtirilgan qo'ng'iroq (dizayn va backend farqi)

Dizayn (admin-lidlar «O'tkazish — 2 ta lid»): Dilnoza R. dagi ikkita rejalashtirilgan qo'ng'iroq boshqa operatorga
o'tkaziladi — «Rejalashtirilgan qo'ng'iroq bronga kirmaydi», «Bronlar 1/5 — o'zgarmaydi», «15:20 va 17:30 — saqlanadi».
Backend hozir vaqti kelmagan `CALLBACK` ni 409 `LEAD_NOT_TRANSFERABLE` bilan rad etadi («lid operatorida qoladi») va
o'tkazilgan lidni `BOOKED` qiladi.

**Taklif:** vaqti kelmagan `CALLBACK` o'tkazilsa — holat va `nextAttemptAt` saqlanadi, `operatorId` almashadi, bron
chegarasiga kirmaydi; tarixga «kimdan kimga, sabab». Mock shunday ishlaydi. Backend o'zgarmaguncha ekran backend xabarini
toastda ko'rsatadi.

## 4. O'tkazish oynasi — operatorlar (`GET /operator/queue-summary` `operators[]`)

| Maydon | Nima uchun | Kelmasa |
|---|---|---|
| `maxBookings` | «1/5 bron», to'la operator tanlanmaydi | 5 (6-qoida) |
| `scheduledCalls` | «+1 rejalashtirilgan», «rejalashtirilgan +1 → +3» | qator ko'rinmaydi |
| `activity {kind: IN_CALL/RINGING/WRAP_UP/CONNECTING/IDLE, leadId, since}` | «suhbatda 02:12 · L-1246», «natija kiritmoqda · L-1256» | «navbatdan lid kutmoqda» |

## 5. Yangi endpointlar — lidlar

| Endpoint | Nima uchun | Kelmasa |
|---|---|---|
| `GET /admin/leads/filter-options` → `{products, operators, affiliates: [{id, name}]}` (ADMIN, SUPERVISOR) | Mahsulot, Operator, Sotuvchi filtrlari — nazoratchiga ham | operatorlar `queue-summary` dan; mahsulot (`/admin/products`) va sotuvchi (`/admin/users?role=AFFILIATE`) faqat adminga |
| `POST /admin/leads/export {filters, columns, phone: LAST4/FULL}` → 202 `{id, rows}` (ADMIN) | «CSV eksport»: fon ishi, tayyor bo'lganda bildirishnoma; audit jurnaliga — kim, qachon, filtr, qatorlar | toastda backend xabari |
| `POST /admin/leads/{id}/release {reason}` (ADMIN) | lid kartasi «Bronni bo'shatish» — lid navbatga qaytadi | tugma xato toast beradi |

## 6. Lid kartasi — taklif maydonlari (`GET /admin/leads/{id}`, `LeadCardDto` ga qo'shimcha)

| Maydon | Nima uchun | Kelmasa |
|---|---|---|
| `phone` (faqat ADMIN, SUPERADMIN; 25-qaror) | «Mijoz» — to'liq raqam va nusxa | «Raqam yashirin — qo'ng'iroq tizim orqali» |
| `operator {id, name, state, since, inCall, callStartedAt}` | «Hozir»: «Dilnoza R. qo'ng'iroq qilmoqda», «Onlayn · 13:15 dan», «suhbat 01:12» | oxirgi urinish operatori, suhbat ko'rinmaydi |
| `bookedAt` | «14:36 → 14:46 · 10 daqiqa», lid yo'li «Bron» | tarixdagi BOOKED yozuvi |
| `queuePosition` | «Navbatda 8-o'rin — 1 daqiqa kutmoqda» | «Navbatda — 1 daqiqa kutmoqda» |
| `closesAt`, `rejectedAt`, `consentAt` | «Avtomatik yopilish», «Qayta ochish … gacha» (3 kun), «Rozilik» | «—» |
| `closedBy {name, at}` | «Kim — Shohruh M. · 13:02» | oxirgi urinish |
| `sameNumberLeads` | «shu raqamdan 2 ta lid» | yozuv yo'q |
| `productInfo {category, wholesalerName, weightGrams, deliveryMode, options}` | «Mahsulot va narx»: rejim, ikki yetkazish narxi | narx obyektidan |
| `stream {code, productName, createdAt, affiliateName, affiliateId, sub1, subs, utmSource, fbclid, ip, device}` | «Manba va klik» | «—» |
| `postbacks [{at, event, attempt, code, state}]` | «Sotuvchi trekeriga xabar» | «Sahifada postback sozlanmagan» |
| `attemptLog [{at, operatorName, channel, outcome, comment, durationSeconds, recording: READY/AFTER_CALL/NONE, recordingUrl, endedBy, notice {from,to}, keptUntil}]` | «Urinishlar» jadvali, «Tinglash», «Yozuvsiz qo'ng'iroq — hisobotda xato» | `attempts` dan, yozuvsiz |
| `mergedInto {id, productName, status, createdAt, streamCode, affiliateName, operatorName, attemptsCount}` | dublikat lid tepasi: «Bu lid» → «Asosiy lid» | asosiy lid havolasi yo'q |
| `order {id, status, createdAt, totalAmount}` | «Buyurtma O-1276» | `orderId` dan havola |
| `reopened {at, by, reason}` | «Qayta ochilgan · 14:39» belgisi | tarixdagi yozuv |

**Yozuvni yuklab olish** (faqat admin): `recordingUrl` — imzolangan havola; backend yuklab olishni audit jurnaliga yozadi
(kim, qachon, qaysi yozuv). Tinglash ham auditga.

**Qayta ochish 3 kun:** TZ 5-bo'lim 10-qoida va dizayn — rad etilganiga 3 kun bo'lmagan lidni faqat admin ochadi; ekran
3 kundan keyin tugmani yopadi. Backend hozir admin uchun chegarasiz ([taklif] izohi) — moslash kerak.

## 7. Yangi endpointlar — buyurtmalar

| Endpoint | Nima uchun |
|---|---|
| `GET /operator/orders`, `GET /operator/orders/{id}` | «Mening buyurtmalarim» — operator o'zi tasdiqlagan buyurtmalar |
| `POST /admin/orders/{id}/dispute {reason}` | «Nizoli» deb belgilash |
| `POST /admin/orders/{id}/elchi/resend` | posilka yaratilmagan bo'lsa Elchi'ga qayta yuborish |
| `PATCH /admin/orders/{id}/address {regionSoato, districtSoato, addressLine, whereDeliver, reason}` | topshirilgunga qadar manzilni o'zgartirish |
| `POST /admin/orders/{id}/sms/resend` | mijozga oxirgi SMS ni qayta yuborish |
| `GET /supervisor/order-requests?state=OPEN/CLOSED`, `POST /supervisor/order-requests/{id}/close` | mijoz so'rovlari (47-qaror): bekor qilish va manzil o'zgartirish |
| `POST /admin/orders/export {filters, columns, phone: LAST4/FULL}` → 202 `{id, rows}` (ADMIN) | «CSV eksport» (admin-buyurtmalar): ro'yxat filtrlari, ustunlar (`order, customer, phone, stream, source, amount, status, track, priceSnapshot, subs`); fon ishi, audit jurnaliga — kim, qachon, filtr, qatorlar |
| `POST /admin/orders/{id}/dispute/close {comment?}` (ADMIN) | «Nizoni yopish» — qo'ng'iroq yozuvi oddiy muddatga (90 kun) qaytadi |
| `POST /admin/orders/{id}/elchi/refresh` → 202 (ADMIN) | «Elchi'dan holatni so'rash» — «Yo'lda» posilkadan webhook kelmasa |
| `POST /admin/orders/{id}/returns/photos` multipart `files[]` (ADMIN) | qaytarish so'roviga mijoz rasmlari (3 tagacha, ≤ 5 MB); so'rov yaratilgandan keyin yuklanadi |
| `POST /admin/orders/{id}/sms/resend {template}` (ADMIN) | qaysi avtomatik SMS qayta yuborilishi (shablon) — audit jurnaliga |
| `POST /admin/orders/{id}/label/reprints {reason}` → 201 `{printedAt, by, count}` (ADMIN) | «Yorliqni qayta chop etish» — sabab majburiy, audit jurnaliga (kim, qachon, sabab); PDF — mavjud `GET /admin/orders/{id}/label`. Endpoint bo'lmasa (404/405/501) chop etish to'xtamaydi, faqat sabab yozilmaydi |

`GET /admin/orders` taklif parametrlari: `search, productId, affiliateId, regionSoato, whereDeliver, confirmedById,
withCounts, sort`; javob maydonlari va buyurtma kartasi bloklari — `src/features/orders/model/orderTypes.ts` (izohlarda
«taklif»). Backend noma'lum parametrni 400 bilan rad etsa, ro'yxat ularsiz qayta so'raladi (`shared/api/optionalParams`).

**Buyurtmalar ro'yxati (admin-buyurtmalar) — backendga talablar:**

- `search` — lid raqami, buyurtma raqami, mijoz ismi, Elchi treki; ≥ 7 raqam bo'lsa — mijoz telefoni (faqat admin, auditga).
- `withCounts=true` → `counts: {ALL, CONFIRMED, PICKING, …}` — status filtrisiz, qolgan filtrlar bo'yicha (holat tablari).
  Bo'lim tablari («Buyurtmalar», «Rad va qaytarishlar») — filtrsiz umumiy son: ekran filtr bo'lsa `limit=1` bilan
  ikkinchi so'rov yuboradi.
- `sort=-statusAt` (sukut) / `statusAt` — «Holat · o'zgardi» ustuni; `statusAt`, `statusDetail` («ertangi to'lqin»,
  «T-0231 aktida», «yorliq chop etildi»), `stockCell` («B-02-1» — bekor qilish oynasi) — ro'yxat qatorida.
- `source` — backendda bor (`LANDING / SITE / API`), `dateFrom/dateTo` — `YYYY-MM-DD` (Toshkent kuni).
- Qator bosilganda panel 560 `GET /admin/orders/{id}` ni o'qiydi: `parcel.act {code, at, count}`, `parcel.label
  {printedAt, by, count}`, `lead.statusHistory` (holat zanjiri).
- «Rad va qaytarishlar» bo'limi (`/admin/orders/returns`) — keyingi qism.


**Buyurtma kartasi (admin-buyurtma-karta, `GET /admin/orders/{id}`) — taklif maydonlari:**

- `statusAt`, `statusDetail` — ro'yxatdagi kabi («Hozir» sarlavhasi, yo'ldagi joriy qadam vaqti).
- `shipDate` — tasdiqlangan buyurtma jo'natiladigan kun (to'lqin): «Ertangi to'lqinda — 15.01.2027 da jo'natiladi».
- `parcel.attempts[] {at, state: FAILED/QUEUED/DONE}` — Elchi'ga posilka so'rovi urinishlari (navbat); «Posilka yaratilmadi».
- `parcel.lastWebhookAt` — «Yo'lda» posilkadan 48 soatdan ortiq webhook kelmasa ogohlantirish (chegara TZ'da yo'q — taklif).
- `sellerOrders[].trackingUrl` — «Elchi kabinetida ochish».
- `money.returnUntil` — qaytarish muddati (EQ-10 hal bo'lguncha `null`, ekranda «hali belgilanmagan»).
- Qaytarish so'rovi: backend `reason` enum kutadi — ekran `OTHER` + `comment` (sabab matni) yuboradi; «Kanal» ro'yxati — 8-savol.
- «Rad etish / Tasdiqlash» (qaytarish) — `/admin/returns/{id}/approve|reject` bor, qaror «Rad va qaytarishlar» bo'limida.

**Nazoratchi buyurtmalari (nazoratchi-buyurtmalar, `/supervisor/orders`) — backendga talablar:**

- Ro'yxat — o'sha `GET /admin/orders` (SUPERVISOR ruxsati bor); «Tasdiqlagan» filtri — `confirmedById` (taklif). Mijoz telefoni
  ko'rinmaydi, CSV yo'q.
- Bekor qilish — `POST /operator/orders/{id}/cancel {reason}` (SUPERVISOR ruxsati bor). Oyna ochiq turganda holat o'zgarsa
  backend 409 `INVALID_STATE` qaytaradi — ekran «bekor qilib bo'lmadi» ko'rinishiga o'tadi va kartani qayta o'qiydi.
- Mijoz so'rovlari (47-qaror, taklif): `GET /supervisor/order-requests?state=OPEN|CLOSED` — har qatorda `order` qisqachasi
  (`OrderListItem`: holat, `statusDetail`, mijoz, tuman, summa, `confirmedBy`) bo'lsin, aks holda har so'rov uchun alohida
  karta so'rovi kerak bo'ladi. Ochiq — eskisi tepada; yopilgan — oxirgi yopilgani tepada.
- `POST /supervisor/order-requests/{id}/close {comment}` — `comment` majburiy («Mijozga nima deyildi»), buyurtma tarixiga va
  so'rovga yoziladi (`closedComment`, `closedBy`, `closedAt`). Bekor qilish yoki manzil bajarilsa so'rov o'zi `DONE` bo'ladi.
- Manzilni o'zgartirish — `PATCH /admin/orders/{id}/address` (SUPERVISOR ham, topshirilgunga qadar); so'rov bo'yicha bo'lsa
  ochiq `CHANGE_ADDRESS` so'rovi `DONE` bo'ladi.

**«Mening buyurtmalarim» (operator-buyurtmalarim, `/operator/orders`) — taklif `GET /operator/orders`:**

- Faqat shu operator «Buyurtma tasdiqlandi» natijasini kiritgan buyurtmalar; parametrlar — `status, search` (lid raqami yoki
  ism; telefon bo'yicha emas — raqam operatorga ko'rinmaydi), `productId, whereDeliver, dateFrom, dateTo, sort, page, limit`.
- Javob: `items` (`confirmedBy {name, at}` — «tasdiq bugun, 10:24»; `statusDetail` — operator o'zi bekor qilgan bo'lsa uning
  ismi, ekran «siz bekor qildingiz» deb ko'rsatadi), `counts` va `facets.products [{id, name}]` — «Mahsulot» filtri uchun
  (operatorga `filter-options` yopiq).
- `GET /operator/orders/{id}` — panel 560: `customerPhone` yo'q, `parcel.act`, `picking.by`.
- Bekor qilish — mavjud `POST /operator/orders/{id}/cancel {reason}` (BUY-3; topshirilgach 409 `INVALID_STATE`).
