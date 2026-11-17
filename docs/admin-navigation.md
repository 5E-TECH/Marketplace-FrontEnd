# Rol menyulari va bo‘lim qo‘shish (karkas-E)

Panel karkasi va har rol menyusi `docs/dizayn/karkas-E.md` (backend repo, DZ-01) bo‘yicha qurilgan (FE-01).
Menyuda faqat **M1** bandlari turadi; M2 va «?» bandlari M1 build’da chiqmaydi.

## Admin va superadmin menyusi (karkas-E 2.4–2.5)

| Guruh | Band | URL | Sahifa |
| --- | --- | --- | --- |
| Ish | Moderatsiya | `/admin/moderation` | tayyorlanmoqda |
| Ish | Lidlar | `/admin/leads` | tayyorlanmoqda |
| Ish | Buyurtmalar | `/admin/orders` | tayyorlanmoqda |
| Katalog | Mahsulotlar | `/admin/products` | tayyorlanmoqda |
| Katalog | Kategoriyalar | `/admin/categories` | ishlaydi |
| Katalog | Qoldiq | `/admin/inventory` | ishlaydi |
| Hamkorlar | Sotuvchilar | `/admin/sellers` | tayyorlanmoqda |
| Hamkorlar | Optoviklar | `/admin/wholesalers` | tayyorlanmoqda |
| Nazorat | Qo‘ng‘iroq yozuvlari | `/admin/recordings` | tayyorlanmoqda |
| Nazorat | Audit jurnali | `/admin/audit-logs` | ishlaydi |
| Tizim | Foydalanuvchilar | `/admin/users` | ishlaydi (rollar hali eski — FE-15) |
| Tizim | Integratsiyalar | `/admin/integrations` | tayyorlanmoqda |
| Tizim | Sozlamalar | `/admin/settings` | tayyorlanmoqda |

«Tayyorlanmoqda» — `PlaceholderPage` («Bo‘lim tayyorlanmoqda»): band menyuda bor, sahifasi o‘z kartasida quriladi.

## FE-01 da uzilgan eski admin sahifalari

Dashboard (`/admin/overview`), Do‘konlar (`/admin/shops`), eski Buyurtmalar tafsiloti (`/admin/orders/:id`),
Yetkazib berish (`/admin/delivery`), Qaytarishlar (`/admin/returns`), eski Mahsulot moderatsiyasi (`/admin/products/:id`),
Bannerlar (`/admin/banners`), Xabarlar (`/admin/notifications`), Moliya (`/admin/finance`), Tizim holati
(`/admin/system-settings`). Ularning URL’i bevosita ochilsa panel ichida 404 chiqadi; e2e testlari o‘chirilgan.
Sahifa fayllari `src/pages` da qolgan, lekin hech qayerga ulanmagan — lid-sotuv modelidagi o‘rinbosari kelganda o‘chiriladi.

## Yangi bo‘limni ulash

1. Sahifa yagona marshrut manifestiga — `src/app/router/routeManifest.tsx` dagi `appRoutes` ga — qo‘shiladi:
   `roles` (kim ochadi), `label` (menyu va yuqori qatordagi `h1`), menyuda bo‘lsa `navIcon`, admin’da `navGroup`,
   ichki sahifa bo‘lsa `section` (menyuda ota bo‘lim faol, yuqori qatorda «‹ Bo‘lim»), omborchi relsi uchun `railLabel`.
   Router, menyu, sarlavha, preload va rol himoyasi (`RequireRole`: boshqa rolga 403) shu yozuvdan olinadi.
   Menyu tartibi — massiv tartibi.
2. Bandi bor, sahifasi hali yo‘q bo‘lsa `load: pending` qoldiriladi; sahifa kelganda faqat `load` almashtiriladi.
3. Sahifa nomi yuqori qatordagi `h1` da: sahifa `PageHeader` (yoki `usePageTitle`) bilan aniqroq nom bersa — o‘sha,
   bermasa — `label`. `main` ichida ikkinchi `h1` bo‘lmaydi.
4. `tests/e2e/roles.spec.ts` (rol menyulari) va `tests/e2e/admin-navigation.spec.ts` (admin menyusi) yangilanadi.

Manifestda yo‘q URL — panel ichida 404 (`NotFoundPage`); kirmagan foydalanuvchi har qanday URL’dan login’ga tushadi.
