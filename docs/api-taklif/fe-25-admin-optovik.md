# FE-25: admin — optovik va uning mahsulotini kiritish — API va taklif

**Holat:** frontend BE-07 (`admin/wholesalers`, `admin/products`), BE-30 (ariza, kabinet egasi, hujjatlar) va BE-41
(MXIK, qadoq kodi) ga ulangan — backend `dev` 5057c14 (`contract/openapi.json` shu holatga sinxronlangan). Mock —
`src/mocks/handlers/wholesalers.ts` (optoviklar FE-16 fixture'i bilan bitta: `src/mocks/fixtures/inbound.ts`).
Quyida: ishlatilgan endpointlar (§1) va backendda **yo'q**, ekran kutayotgan endpoint va maydonlar — taklif (§2–).
Taklif maydoni backend rad etsa (`forbidNonWhitelisted` → 400 `details[].field`), so'rov ularsiz qayta yuboriladi
(`withOptionalBody`, `src/shared/api/optionalParams.ts`) — asosiy ma'lumot saqlanadi.

Dizayn: Panel 2 — `admin-optoviklar`, `admin-optovik-karta`, `admin-mahsulotlar`, `admin-mahsulot-karta`,
`admin-moderatsiya` (har biri `.planshet`, `.mobil`, `.holatlar` bilan).

## 1. Ishlatilgan endpointlar

| Amal | Yo'l | Izoh |
|---|---|---|
| Optoviklar | `GET /admin/wholesalers` (ADMIN, SUPERADMIN; WAREHOUSE — qisqa ko'rinish) | `search` (nom qismi yoki STIR aniq), `page`, `limit` ≤ 100; yangisi tepada |
| Optovik | `GET /admin/wholesalers/{id}` | `WholesalerDto` |
| Kiritish | `POST /admin/wholesalers` | foydalanuvchisiz, holat darhol `ACTIVE`; STIR 9, hisob 20, MFO 5 raqam; STIR takror — 409 |
| Tahrirlash | `PATCH /admin/wholesalers/{id}` | berilgan maydonlar; `status` faqat `ACTIVE` ↔ `SUSPENDED` |
| Ariza (M2) | `POST /admin/wholesalers/{id}/review {decision, note?}` | faqat `PENDING`; rad etishda sabab |
| Kabinet (M2) | `POST /admin/wholesalers/{id}/owner {phone, fullName}` | egasi bor bo'lsa — 409 |
| Hujjatlar | `GET /admin/wholesalers/{id}/documents`, `POST …/documents/{documentId}/link` | KYC, sertifikatlar; 10 daqiqalik havola |
| Elektron shartnoma | `POST /admin/wholesalers/{id}/contract/link` | kabinetda imzolangan PDF |
| Postavkalar, qoldiq | `GET /admin/inventory/shipments?wholesalerId`, `GET /admin/inventory/stock?shopId` | karta yorliqlari |

## 2. Optovikni kiritish — shartnomasiz saqlash

Dizayn (`admin-optovik-karta.holatlar` «Yangi optovik»): «Shartnomasiz optovik saqlanadi, lekin unga mahsulot va
postavka qo'shib bo'lmaydi»; kartaning TC3 i shunday optovikni talab qiladi. Backend `CreateWholesalerDto` da
`contractNumber` va `contractDate` **majburiy**. Taklif: ikkalasi ixtiyoriy (lekin birga) — mahsulot qo'shish
cheklovi (`hasContract`, 409) o'zgarmaydi. Hozir backend 400 qaytarsa, xato shartnoma maydonlari ostida chiqadi.

| Maydon | Nima uchun | Backend rad etsa |
|---|---|---|
| `directorName` (create, PATCH, javob) | «Rahbar (F.I.Sh.)» — rekvizitlar kartasi va forma | ularsiz saqlanadi, kartada «—» |

## 3. Komissiya shartnomasi — qog'oz nusxa (skan)

Pilotda shartnoma — imzolangan qog'oz nusxaning skani (dizayn: «Shartnoma yuklash» oynasi). Backendda admin uchun
fayl yuklash yo'q (optovik o'zi `POST /wholesaler/documents` bilan yuklaydi).

`POST /admin/wholesalers/{id}/contract` (multipart): `file` (PDF/JPEG/PNG, 10 MB gacha, ixtiyoriy), `contractNumber`,
`contractDate` → `WholesalerDto`. Fayl yopiq joyga (BE-30 hujjatlari kabi), javobda:

| Javob maydoni | Nima uchun |
|---|---|
| `contractFile {id, fileName, uploadedAt, uploadedBy}` | «shartnoma-skan.pdf · Yuklandi 28.12.2026 · Nodira K.»; yuklab olish — `documents/{id}/link` |

## 4. Ro'yxat va karta — yig'ma raqamlar (`GET /admin/wholesalers`, `GET /admin/wholesalers/{id}`)

Pilotda optovik o'nlab — holat yorliqlari, «Shartnoma» va «Kabinet» filtrlari hamda sonlar brauzerda hisoblanadi
(hammasi 100 tadan sahifalab olinadi). Optoviklar ko'payganda: `status`, `contract` (`SIGNED|MISSING`),
`cabinet` (`ACTIVE|INVITED|NONE`) parametrlari va `counts`.

| Javob maydoni | Nima uchun | Kelmasa |
|---|---|---|
| `stats.products {total, onSale, noStock}` | «4 ta sotuvda · 1 tasi qoldiqsiz» | «—» |
| `stats.stock {onHand, available, reserved}` | «206 dona · 191 tayyor · 15 bandda» (ombor hisobi bilan bir xil) | «—» |
| `stats.shipments {total, waiting, waitingQty, waitingCodes[], lastDefect {code, quantity}}` | «3 ta kutilmoqda · P-0112: 2 ta brak», «Qabul kutilmoqda» | «—» |
| `stats.payable {amount, held}` | «To'lanadigan 20 080 000 so'm · ushlab turilgan 2 420 000» (BE-33 hisobi) | «—» |
| `cabinet {phone, invitedAt, openedAt, lastActiveAt}` | Kabinet kartasi: taklif yuborildi, ochildi, oxirgi faollik | `ownerUserId` bo'yicha «faol / yo'q» |
| `createdBy` | «28.12.2026, 10:05 — Nodira K.» | sana o'zi |

`GET /admin/wholesalers/attention` — «Diqqat talab qiladi» (hamma optovik bo'yicha), element turlari:

| `kind` | Maydonlar | Matn |
|---|---|---|
| `SHIPMENT_DEFECT` | `shipmentId, shipmentCode, productName, declared, received, defect` | «P-0112 · Simsiz quloqchinlar — 2 ta brak» |
| `OUT_OF_STOCK` | `productId, productName, onHand, reserved, incomingCode, incomingQty` | «Bolalar termos shishasi — qoldiq tugagan» |
| `DEFECT_NOT_RETURNED` | `quantity, fromReceiving, receivingCodes[], fromReturns, returnCodes[]` | «Brak 4 dona — optovikka hali qaytarilmagan» |
| `SETTLEMENT_READY` | `settlementId, code, periodFrom, periodTo, amount` | «AS-0001 akt-sverka — «Tayyor»» |

Har birida `id, wholesalerId, wholesalerName`. Backend bermasa (yo'l `:id` ga tushib 404) blok bo'sh.

## 5. Optovikka aktlar — ro'yxat va yuborish

Sarlavhadagi «Aktni yuborish» (holatlar §5): brak akti (qaytgan tovar), qabul (farq) akti yoki akt-sverka.

- `GET /admin/wholesalers/{id}/acts` → `[{ id, kind: DEFECT|RECEIVING|SETTLEMENT, code, title, at, sentAt }]` (yangisi tepada;
  `title` — «Elektr choynak · 1 dona · L-1031»).
- `POST /admin/wholesalers/{id}/acts/{actId}/send {channels: ['CABINET' | 'PRINT']}` — kabinetga (optovik «Qaytganlar va
  brak» bo'limida ko'radi) va/yoki chop etish (tovar bilan). Kabineti yo'q optovikka kanal — [TZ'da yo'q — 26-savol].

## 6. Tovar holati (kartadagi 5 raqam) va mahsulot bo'yicha sotuv

`stats.goods {inTransit, sold, soldAmount, returned, returnedSorting, returnedInElchi, defect, defectReceiving, defectReturns}`
— «Yo'lda 27 dona», «Sotilgan 187 dona · 22 500 000 so'm», «Qaytgan 5: 3 tasi omborda saralanmoqda, 2 tasi Elchi'da»,
«Brak 4: qabulda 2, qaytgan tovardan 2».

`GET /admin/products?shopId=` elementida `sales {inTransit, sold, returned}` — kartadagi mahsulotlar jadvali (omborda,
bandda, mavjud, brak — `GET /admin/inventory/stock?shopId`, BE-16/17).

## 7. Pul va aktlar (BE-33 moliya hisobi)

`stats.money`: `payable, payableQty, held, heldQty, paid, written, writtenQty, formula [{quantity, basePrice}],
nextActAt, lastAct {id, code, periodFrom, periodTo, status READY|ACCEPTED|DISPUTED|PAID, preparedAt, counted, notCounted,
transfer}`. Akt PDF — mavjud `GET /admin/finance/settlements/{id}/act.pdf`.

## 8. Holat va bank rekviziti o'zgarishi

| Maydon / yo'l | Nima uchun |
|---|---|
| PATCH `reason` (status `SUSPENDED` bilan) | «To'xtatish» oynasida sabab majburiy (audit); backend rad etsa — sababsiz saqlanadi |
| javob: `statusChangedAt`, `statusChangedBy`, `suspendReason` | «To'xtatilgan · 12.01.2027, 16:40 · Nodira K. Sabab: «…»» banneri |
| javob: `bankChangeRequest {id, requestedAt, bankName, bankMfo, bankAccount, file}` | kabinetdan so'ralgan yangi hisob (M2) |
| `POST /admin/wholesalers/{id}/bank-change/{requestId}/review {decision: APPROVE|REJECT}` | bank xati bilan solishtirib tasdiqlash; tasdiqlanguncha o'tkazma eski hisobga ([?] kim tasdiqlaydi — 37-savol) |

## 9. Mahsulot formasi (OPT-2): yangi mahsulot, tahrir, qoralama va yuborish

Admin mahsulotni optovik nomidan kiritadi (admin-mahsulot-karta «Asosiy» va …holatlar). Mavjud: `POST /admin/products`
(BE-07 `adminCreate`: shartnomasiz optovik — 409; og'irlik, uch o'lcham, bazaviy narx va kamida bitta rasm majburiy; holat
`PENDING_REVIEW`; bitta SKU avtomatik) va `PATCH /admin/products/{id}` (holat o'zgarmaydi; sotuvdagi CPA mahsulotida MXIK va
qadoq kodi majburiy — BE-41). Frontend og'irlikni kg, o'lchamni sm da oladi va gramm/mm ga o'tkazadi.

| Maydon / yo'l | Nima uchun | Backend bilmasa |
|---|---|---|
| tanada `slug` (create va PATCH) | «Slug» maydoni: nomdan avtomatik, qo'lda o'zgartiriladi; takror — 409 `details: [{field: 'slug'}]` va `conflictWith {id, name}` («Bu slug band: «Simsiz quloqchinlar» mahsulotida») | 400 `details[].field` → so'rov `slug` siz qayta yuboriladi (backend nomdan yaratadi) |
| tanada `subtitle` | «Qisqa tavsif» — nom ostidagi bir qator (fe-12 §1 bilan bir xil) | maydonsiz qayta yuboriladi |
| tanada `expiryTracked` | «Yaroqlilik muddati kuzatiladi» — mahsulotning o'zida belgilash (kategoriyadan meros o'rniga); javobdagi `expiryTracked` hozir samarali qiymat | maydonsiz qayta yuboriladi |
| create tanasida `videos: string[]` | yangi mahsulot videolari — kreativlar kutubxonasiga (BE-08) birga tushadi | maydonsiz qayta yuboriladi; video keyin «Kreativlar» yorlig'idan |
| create tanasida `draft: true` | «Qoralamani saqlash» — holat `DRAFT`, moderatsiya navbatiga tushmaydi | **qayta yuborilmaydi**: so'rov rad etiladi, mahsulot jimgina moderatsiyaga ketmaydi |
| javobda `createdByName` | «Kiritgan: Nodira K. · 06.01.2027, 10:05» (Optovik bo'limi) | qator ko'rsatilmaydi |
| `POST /admin/products/media` (multipart `file`) → `{url, type: IMAGE\|VIDEO, fileName}` | yangi mahsulot hali yo'q — rasm/video saqlashdan oldin yuklanadi (BE-07 create `images[]` URL kutadi). JPG, PNG, WEBP rasm (10 MB gacha), MP4, MOV video (100 MB gacha) — [TZ'da rasm hajmi yo'q] | yuklash xatosi ko'rsatiladi; mahsulot rasmsiz saqlanmaydi |
| `POST /admin/products/{id}/submit` | qoralamani yoki tuzatilgan rad etilgan mahsulotni moderatsiyaga yuborish → `PENDING_REVIEW` (`DRAFT`, `REJECTED` dan; boshqa holat — 409) | «Moderatsiyaga yuborish» xatosi ko'rsatiladi |

Rad etilgan mahsulotda «Qayta yuborish» tuzatish saqlangach yonadi: `updatedAt > statusChangedAt` (fe-12 §1 taklifi);
`statusChangedAt` kelmasa — tugma ochiq, backend hal qiladi.

## 10. Mahsulot kartasi oynalari: rasm va video, sertifikat, arxivlash

**Rasm va video qo'shish** (holatlar 4, Ph7) — bir nechta fayl, har biri alohida holatda (yuklanmoqda — foiz va to'xtatish,
yuklandi, noto'g'ri tur, katta hajm). Saqlangan mahsulotda mavjud BE-08 oqimi: `POST …/creatives/upload` (imzolangan POST) →
fayl → «Qo'shish» bosilganda har biri `POST …/creatives {objectKey}`. Cheklov BE-08 sozlamasidan: rasm JPG/PNG/WebP 10 MB,
video MP4/WebM 100 MB. «Yuklangan rasmni asosiy qilish» — mavjud BE-07 `PATCH /admin/products/{id} {imageUrl, images}` (yangi
rasm birinchi). Yangi mahsulotda — §9 `POST /admin/products/media`, URL lar `images`/`videos` bilan yaratishda yuboriladi.

| Yo'l | Nima uchun | Backend bilmasa |
|---|---|---|
| `POST /admin/products/{id}/certificate` (multipart `file`, ixtiyoriy `note` ≤ 200) → mahsulot (`certificate {name, url, uploadedAt}`) | «Sertifikat qo'shish»: yopiq fayl, admin moderatsiyada ko'radi, sotuvchiga ko'rinmaydi; yangi fayl eskisining o'rniga. Turi va hajmi — [TZ'da yo'q]; taklif: PDF, JPG, PNG, 10 MB | xato ko'rsatiladi, sertifikat yuklanmaydi |
| `DELETE /admin/products/{id}/certificate` → mahsulot | sertifikat qatoridagi «olib tashlash» | xato ko'rsatiladi |
| `POST /admin/products/{id}/archive` → mahsulot (`status: ARCHIVED`) | «Arxivlash»: karta, narx qarorlari va audit saqlanadi, ro'yxatdan yashiriladi («Arxiv» filtri). Sotuvdagi (to'xtatilmagan) yoki qoldig'i/ochiq buyurtmasi bor mahsulot — 409 `INVALID_STATE` (avval to'xtatiladi) | xato ko'rsatiladi |

Audit: `product.certificate {fileName, note}`, `product.certificate.delete`, `product.archive`.

**Arxiv ro'yxatda.** `GET /admin/products?status=ARCHIVED` — mavjud (BE-07 `AdminProductsQueryDto.status`). Holatsiz so'rov
arxivni ham qaytaradi — frontend «Hammasi» dan arxivlanganlarni olib tashlaydi. `GET /admin/moderation/summary` (BE-27)
`byStatus.ALL` arxivni ham sanaydi; taklif: `byStatus.ARCHIVED` — «Arxiv» yorlig'idagi son («Hammasi» = `ALL − ARCHIVED`);
kelmasa «Arxiv» yorlig'ida son ko'rsatilmaydi.

**Moderatsiyada fiskal kodlar (BE-41).** Tasdiqda backend CPA mahsulotidan MXIK va qadoq kodini (400), optovikdan STIR ni
(409) talab qiladi. Moderatsiya «Tizim tekshiruvi» da shu band ko'rsatiladi; o'tmasa «Mahsulotni tasdiqlash» o'chiq va
mahsulot kartasiga havola (kodlar formaning «Sertifikat va toifa» bo'limida). Yangi endpoint kerak emas.
