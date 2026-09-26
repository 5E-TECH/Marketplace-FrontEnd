# Admin buyurtmalar: TC1–TC4 tekshiruvi

Backend manbasi: [5E-TECH/marketplace — SellerOrdersService](https://github.com/5E-TECH/marketplace/blob/668847c8af2a35c1022567992797d33b4c79cc03/apps/checkout-service/src/seller-orders.service.ts), `adminListOrders` va `adminGetOrder`.

## Moslashtirilgan maydonlar

- Ro‘yxat `id`, `buyerName`, `status`, `paymentMethod`, `totalAmount`, `deliveryFee`, `sellersCount`, `createdAt` qaytaradi. Alohida buyurtma raqami bo‘lmasa `id` ishlatiladi.
- Ro‘yxatda do‘kon nomi/ID yo‘q: UI do‘konlar sonini ko‘rsatadi. Detail `sellerOrders[].shopId` orqali do‘kon ID’larini ko‘rsatadi. API nom qaytarsa mavjud nom ko‘rsatish imkoniyati saqlangan.
- Jo‘natma sub-buyurtmadagi `elchiShipmentId` va `trackingUrl` dan olinadi.
- Mahsulot jami `lineTotal` dan olinadi; mavjud summa qayta hisoblanmaydi.
- Alohida `payment` obyekti bo‘lmasa, `paymentMethod` va `totalAmount` ko‘rsatiladi. Tranzaksiya ID va to‘lov statusi taxmin qilinmaydi.
- `dateTo` backendda keyingi kun boshlanishidan oldingi vaqtni qamraydi: tanlangan oxirgi kun ham filtrga kiradi.

## Avtomatik tekshiruvlar

`tests/e2e/admin-orders.spec.ts`:

- TC1: turli sotuvchilar, jadval ustunlari, pagination.
- TC2: holat/to‘lov/do‘kon/sana filtrlari, birgalikdagi filtr, reset, sahifani 1 ga qaytarish, API xatosidan tiklanish.
- TC3: sub-buyurtma/item/jo‘natma/to‘lov/tarix, backend formatidagi javob, desktop/mobile, detail loading va 404 dan qayta urinish. Admin buyurtmalarga faqat GET yuboriladi; istisno — yorliq (`POST /admin/orders/labels`) va refund/cancel (`POST /admin/orders/{id}/refund|cancel`).
- TC4: boshlang‘ich loading, buyurtmasiz va filtr natijasiz holatlar.
- Refund/cancel (v1 — faqat COD: refund tugmasi hech bir buyurtmada ko‘rinmaydi, u v2 online to‘lov uchun; cancel DRAFT/PENDING_PAYMENT uchun ishlaydi): tugma faqat mos holatda ko‘rinadi (refund — online va PAID/CONFIRMED/PARTIALLY_FULFILLED/FULFILLED; cancel — DRAFT/PENDING_PAYMENT), sabab 5–500 belgi, ikki marta bosishda bitta so‘rov, `idempotent: true` va 400/403/404 xabarlari.

Testlar HTTP javoblarini mock qiladi; backend formatidagi fixture yuqoridagi commit kodidan tekshirilgan. Bu jonli backend va DB bilan integratsion test o‘rnini bosmaydi.

## Backendda qolgan cheklovlar

`adminGetOrder` tarixni o‘qimaydi va javobga qo‘shmaydi. Tarix ko‘rsatish uchun shu endpoint seller-order history yozuvlarini qaytarishi kerak. Frontend `history` yoki `sellerOrders[].history` ichidagi `id`, `status`, `comment`, `createdAt` maydonlarini qabul qiladi; hozir backend yubormasa bo‘sh holat chiqadi.

Jadvalda do‘kon nomlarini ko‘rsatish uchun `adminListOrders` javobini do‘konlar ma’lumoti bilan kengaytirish kerak. Hozirgi endpoint faqat `sellersCount` qaytaradi.

Lokal sozlamadagi backend (`192.168.1.190:3000`) tekshiruv vaqtida ulanmagan; jonli admin sessiyasi bilan tekshiruv bajarilmadi.
