# FE-16: ombor — postavka e’loni va qabuli, partiya va muddat — API taklifi

**Holat:** taklif. Backendda BE-17 («Ombor: postavka qabuli, SKU va yacheyka, muddat…») hali yo‘q; BE-16
(`feat/be-16-ombor`) faqat `POST /admin/inventory/inbound|adjust` va `GET /admin/inventory/stock` beradi.
Frontend shu shakl bilan `src/mocks/handlers/warehouse.ts` orqali ishlaydi; endpointlar `contract/pending-endpoints.json`
da. Rollar — `ADMIN`, `SUPERADMIN`, `WAREHOUSE` (BE-17: «DECLARED ni WAREHOUSE yoki ADMIN roli optovik nomidan ochadi»).

Dizayn (Panel 2): `ombor-qabul`, `admin-postavka`, `ombor-muddat`, `ombor-qoldiq`; hujjat `hujjat-qabul-akti`;
Panel 1 `umumiy-aloqa-uzildi` («Ombor — skan navbati»). TZ: 6.6 OMB-1, OMB-2, OMB-3; T4 inbound_shipment, stock_lot.

## 1. Postavka (`inbound_shipment`)

Bitta postavka — bitta optovikning bitta mahsuloti (SKU): BE-17 «optovik, mahsulot, son, kelish sanasi».
Formada bir nechta qator bo‘lsa, har qator alohida postavka bo‘ladi (raqam ketma-ket: P-0114, P-0115).

```json
{
  "id": "112",
  "number": "P-0112",
  "status": "DECLARED",
  "wholesaler": { "id": "7", "name": "Namuna Savdo MChJ", "tin": "307418562" },
  "sku": {
    "productId": "501", "variantId": "50101", "name": "Simsiz quloqchinlar", "barcode": "4780012345677",
    "expiryTracked": false, "categoryName": "elektronika", "cell": "B-02-1"
  },
  "declared": 100, "accepted": 98, "defect": 2,
  "expectedAt": "2027-01-14",
  "note": null, "waybillNumber": null,
  "createdAt": "2027-01-11T09:20:00.000Z",
  "createdBy": { "name": "Nodira Karimova", "role": "ADMIN" },
  "inTransitAt": null,
  "receivingStartedAt": "2027-01-14T09:05:00.000Z",
  "completedAt": null,
  "completedBy": null,
  "actNote": null,
  "cancelledAt": null, "cancelReason": null,
  "lots": [{ "id": "L-112", "number": "P-0112", "expiresAt": null, "quantity": 98, "sellable": true }]
}
```

- `status`: `DECLARED` (e’lon qilindi), `IN_TRANSIT` (yo‘lda — kim belgilashi TZ’da yo‘q), `RECEIVED` (farqsiz),
  `DISCREPANCY` (farq bor: brak, kam yoki ortiq), `CANCELLED` (admin-postavka «Bekor qilindi»).
- `accepted` — qabul qilingan, sotuvga yaroqli; `defect` — brak (qoldiqqa kirmaydi). Farq = `accepted − declared`;
  «kam/ortiq» = `accepted + defect − declared`.
- `createdBy.role`: `WHOLESALER` — optovik kabinetida (FE-23, M2); boshqalari — xodim optovik nomidan.
- `receivingStartedAt` — qabul boshlangan («hozir sanalmoqda»); `completedAt` — yakunlangan, akt sanasi.
- `actNote` — omborchi izohi (aktga). `lots` — partiyalar (2-bo‘lim); muddatsiz tovarda bitta, postavka raqami bilan.
- `sku.cell` — SKU yacheykasi (BE-17: «SKU shtrix-kod va yacheyka manzili»). `expiryTracked` — kategoriyadan meros
  (FE-12 taklifi, `docs/api-taklif/fe-12-admin-moderatsiya.md` §9).

## 2. Endpointlar

| So‘rov | Ma’nosi |
| --- | --- |
| `GET /warehouse/inbound-shipments` | Ro‘yxat. Filtrlar: `status` (vergul bilan: `DECLARED,IN_TRANSIT`), `wholesalerId`, `authorRole` (`WHOLESALER` \| `STAFF`), `expectedFrom`, `expectedTo`, `completedOn` (Toshkent sanasi), `search` (raqam, mahsulot, shtrix-kod), `sort` (`-createdAt` sukut, `expectedAt`, `-completedAt`), `page`, `limit`. Javob: `{ items, total, page, limit, totalPages, counts }`; `counts` — holat bo‘yicha va `ALL`, `status` filtrisiz (tablar). |
| `POST /warehouse/inbound-shipments` | E’lon optovik nomidan: `{ wholesalerId, expectedAt, note?, waybillNumber?, items: [{ variantId, quantity }], idempotencyKey }` → `201 { items: [postavka] }`. 409 `CONTRACT_REQUIRED` — shartnoma yo‘q; 409 `PRODUCT_NOT_APPROVED` — mahsulot tasdiqlanmagan; 400 — sana o‘tgan, miqdor 1…100 000 emas. Bir xil `idempotencyKey` — o‘sha javob. |
| `GET /warehouse/inbound-shipments/{id}` | Tafsilot (1-bo‘lim). |
| `POST /warehouse/inbound-shipments/{id}/cancel` | `{ reason }` — faqat `DECLARED` va qabul boshlanmagan; aks holda 409. |
| `POST /warehouse/inbound-shipments/{id}/receiving` | Qabulni boshlash (`receivingStartedAt`), takror chaqiruv o‘zgartirmaydi. Faqat `DECLARED` / `IN_TRANSIT`. |
| `GET /warehouse/inbound-shipments/{id}/scans` | Skan jurnali: `{ items (oxirgi 50, yangisi tepada), total }`. |
| `POST /warehouse/inbound-shipments/{id}/scans` | Skan: `{ barcode, mode: ACCEPT\|DEFECT, lotId?, scannedAt, idempotencyKey }` → `{ scan, shipment }`. |
| `DELETE /warehouse/inbound-shipments/{id}/scans/{scanId}` | Oxirgi hisoblangan skanni bekor qilish → postavka; boshqasi — 409 `NOT_LAST_SCAN`. |
| `POST /warehouse/inbound-shipments/{id}/lots` | Partiya: `{ number, expiresAt }` → postavka (`201`). |
| `POST /warehouse/inbound-shipments/{id}/complete` | Yakunlash: `{ note?, confirmShortage? }` → postavka (`RECEIVED` yoki `DISCREPANCY`). |
| `GET /warehouse/wholesalers` | Optoviklar va SKU lari (3-bo‘lim). |

### Skan (`scan`)

```json
{ "id": "S-112-101", "at": "2027-01-14T09:36:10.000Z", "barcode": "4780012345677", "mode": "ACCEPT",
  "result": "ACCEPTED", "total": 98, "productName": null, "lotNumber": "P-0112" }
```

- `result`: `ACCEPTED` / `DEFECT` — hisoblandi (`total` — shundan keyingi son: «Qabul 98», «Brak 2»);
  `UNKNOWN` — kod hech bir SKUda yo‘q (TC2, «Yozilmadi»); `FOREIGN` — boshqa mahsulot kodi (`productName`), bu postavkada yo‘q.
- Takroriy skan (TC3) serverga bormaydi: brauzer bir xil kodni 1 soniya ichida ikkinchi marta o‘qisa tashlab yuboradi
  (oraliq TZ’da yo‘q — taklif). `idempotencyKey` — tarmoq uzilib qayta yuborilgan skan ikki marta yozilmasligi uchun
  (oflayn navbat, umumiy-aloqa-uzildi): server birinchi javobni qaytaradi.
- Qabul boshlanmagan yoki yakunlangan postavkaga skan — 409 `INVALID_STATE`; muddatli tovarda `lotId` yo‘q — 409 `LOT_REQUIRED`.

### Yakunlash

- `accepted + defect = 0` — 409 `NOTHING_COUNTED`. Sanaldi < e’lon va `confirmShortage` yo‘q — 409 `SHORTAGE_NOT_CONFIRMED`
  (ekranda avval «Qayta sanash», keyin «Kam deb yakunlash»).
- Holat: `accepted = declared` va `defect = 0` → `RECEIVED`, aks holda `DISCREPANCY`.
- Qoldiqqa faqat `accepted` kiradi; brak — alohida (optovikka qaytariladi); `sellable: false` partiya «mavjud»ga qo‘shilmaydi.
- Yakunlangach skanlar o‘zgarmaydi; akt (hujjat-qabul-akti) shu postavkadagi sonlar bilan chiqadi — «Aktdagi son tizim bilan mos».
- **Akt optovikka avtomatik yuborilmaydi** (FE-16, BE-17: optovik kabineti FE-23 kelguncha qo‘lda). Frontend aktni ekrandan
  PDF qiladi (A4, chop etish), alohida PDF endpoint shart emas.

## 3. Partiya va yaroqlilik muddati (OMB-3)

- Muddat faqat `expiryTracked` SKU da (BAD, kosmetika, oziq-ovqat) so‘raladi: birinchi skandan oldin partiya ochiladi,
  keyingi skanlar shu partiyaga (`lotId`). Qadoqdagi sana boshqacha bo‘lsa — yangi partiya (`P-0120-2`).
- `sellable = expiresAt − bugun ≥ 60 kun` (server hisoblaydi). Muddati o‘tgan sana — 400. 60 kundan kam qolgan partiya
  qoldiqqa kiradi, lekin «mavjud»ga qo‘shilmaydi; optovik va adminga xabar ketadi (BE-17, kanal TZ’da yo‘q).

## 4. Optoviklar — `GET /warehouse/wholesalers`

E’lon formasi (admin) va «Arizasiz postavka» (omborchi) uchun bitta so‘rov; `/admin/wholesalers` omborchiga ochiq emas.

```json
{ "items": [{
  "id": "7", "name": "Namuna Savdo MChJ", "tin": "307418562", "status": "ACTIVE",
  "contractSigned": true, "contractNumber": "K-2027/014", "contractDate": "2026-12-28",
  "cabinet": { "lastSeenAt": "2027-01-14T09:35:00.000Z" },
  "onHand": 206,
  "awaiting": { "shipments": 3, "quantity": 210 },
  "products": [{
    "productId": "501", "variantId": "50101", "name": "Simsiz quloqchinlar", "barcode": "4780012345677",
    "expiryTracked": false, "categoryName": "elektronika", "cell": "B-02-1",
    "status": "ACTIVE", "reviewSince": null, "onHand": 128, "available": 120
  }]
}] }
```

- `contractSigned` — shartnoma raqami va sanasi bor (BE-07 `contractNumber`, `contractDate`); yo‘q bo‘lsa ariza kiritib bo‘lmaydi.
  `contractNumber`, `contractDate` — qabul aktidagi «Asos: Komissiya shartnomasi № …» uchun.
- `cabinet` — optovik kabineti (FE-23, M2): `null` — hali yo‘q.
- `products` — optovikning hamma mahsuloti: `ACTIVE` dan boshqasi formada o‘chiq, sababi bilan («Ko‘rib chiqilmoqda
  (13.01.2027 dan)» — `reviewSince`). Shtrix-kod bo‘yicha skan qaysi mahsulotniki ekanini ham shundan topadi.

## 5. Qoldiq va partiyalar (ombor-qoldiq, ombor-muddat)

### `GET /admin/inventory/stock` (BE-16) — omborchi ko‘rinishi uchun qo‘shimcha maydonlar

BE-16 da endpoint omborchiga ham ochiq (`@Roles(ADMIN, WAREHOUSE, SUPERADMIN)`). «Qoldiq → Ro‘yxat» bitta so‘rovda chiqishi uchun
qatorga (hammasi ixtiyoriy, kelmasa «—»):

```json
{ "shopName": "Namuna Savdo MChJ", "barcode": "4780012345677", "cell": "B-02-1", "defect": 0,
  "reservedToday": 6, "reservedTomorrow": 2,
  "lots": [{ "number": "P-0097", "expiresAt": null, "sellable": true }] }
```

- `available` — sotuvga: `onHand − reserved − (sotuvdan chiqarilgan partiyalar)`; 60 kundan kam qolgan partiya omborda, lekin
  `available` ga kirmaydi (FE-16 TC4). `defect` — brak, qoldiqqa kirmaydi (optovikka akt bilan qaytadi).
- `reservedToday` / `reservedTomorrow` — «Band qayerda»: bugungi va ertangi to‘lqin (FE-17).

### Partiyalar — `GET /warehouse/lots`

Filtrlar: `state` (`APPROACHING` | `BLOCKED` | `EXPIRED`), `wholesalerId`, `search` (partiya, mahsulot, shtrix-kod).

```json
{
  "items": [{
    "id": "L-120-2", "number": "P-0120-2", "state": "BLOCKED", "quantity": 60, "expiresAt": "2027-03-05",
    "sku": { "variantId": "51101", "name": "Vitamin kompleksi", "barcode": "4780012345714", "cell": "C-03-2", "expiryTracked": true },
    "wholesaler": { "id": "8", "name": "Namuna Farm MChJ", "tin": "307418570" },
    "sharesCellWith": "P-0120-1",
    "notifiedAt": "2027-01-14T09:39:00.000Z"
  }],
  "counts": { "ALL": 2, "APPROACHING": 0, "BLOCKED": 1, "EXPIRED": 0 },
  "rules": { "minShelfDays": 60, "notifyDays": null },
  "untracked": [{ "variantId": "50101", "name": "Simsiz quloqchinlar" }]
}
```

- `state`: `ON_SALE`, `APPROACHING` (xabar oldidan N kun — TZ’da yo‘q, `notifyDays: null`), `BLOCKED` (< 60 kun, sotuvdan
  chiqarilgan), `EXPIRED`, `RETURNING` (optovikka qaytarishga qo‘shilgan), `WRITTEN_OFF`. Ro‘yxat eng yaqin muddat tepada.
- `sharesCellWith` — sotuvdan chiqarilgan partiya sotuvdagisi bilan bir yacheykada (shtrix-kod bir xil — yig‘ishda farqlanmaydi).
- `POST /warehouse/lots/{id}/write-off` `{ quantity, reason: EXPIRED|DAMAGED|OTHER, note }` — izoh majburiy, miqdor partiyadan
  ko‘p emas; audit jurnaliga. Kim qila oladi — 32-qaror.
- `POST /warehouse/lots/{id}/return` `{ quantity, note? }` — akt yaratmaydi: tovar «Optovikka topshirish» ro‘yxatiga (FE-18).
