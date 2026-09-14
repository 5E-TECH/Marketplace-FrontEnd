# Admin menyusidagi vaqtincha yashirilgan bo‘limlar

Admin menyusi faqat tayyor UI sahifasi, router marshruti va rol himoyasi mavjud bo‘lgan bo‘limlarni ko‘rsatadi. Quyidagi bandlar UI tayyor bo‘lmagani sababli vaqtincha yashirilgan.

| Menyu bandi | Rejalashtirilgan URL | Backend holati |
| --- | --- | --- |
| Sotuvchilar | `/admin/sellers` | Alohida admin UI uchun kontrakt tayyor emas |
| Komissiya tarixi | `/admin/payout-history` | `/admin/finance/payouts` mavjud |
| Brendlar | `/admin/brands` | Tayyor emas |
| Atributlar | `/admin/attributes` | Tayyor emas |
| Tranzaksiyalar | `/admin/transactions` | `/payments` mavjud |
| Omborlar | `/admin/warehouses` | `/inventory/warehouses` mavjud |
| Qoldiq monitoringi | `/admin/stock` | `/inventory/stock` mavjud |
| Transfer so‘rovlari | `/admin/transfers` | Tayyor emas |
| Bannerlar | `/admin/banners` | Tayyor emas |
| Promokodlar | `/admin/promocodes` | Tayyor emas |
| Flash sale va kolleksiyalar | `/admin/collections` | Tayyor emas |
| Sharh moderatsiyasi | `/admin/reviews` | `/storefront/products/{id}/reviews` mavjud |
| Reyting va shikoyatlar | `/admin/disputes` | Tayyor emas |
| Jamoa | `/admin/team` | Kabinet UI sahifasi tayyor emas |

`/admin/audit-logs` avval yashirilgan edi. Audit UI, `GET /api/v1/admin/audit` integratsiyasi va rol himoyasi tayyor bo‘lgach menyuga qaytarildi.

Bandni menyuga qaytarish uchun:

1. Ishlaydigan sahifa va backend integratsiyasi tayyor bo‘lishi kerak.
2. Marshrut `src/app/router/AppRouter.tsx` ichida kerakli rol guard bilan ro‘yxatdan o‘tishi kerak.
3. Band `src/features/adminDashboard/model/adminNavigation.tsx` ichiga kerakli rollar bilan qo‘shilishi kerak.
4. `tests/e2e/admin-navigation.spec.ts` dagi mavjud va yashirilgan bandlar ro‘yxati yangilanib, barcha E2E testlar o‘tishi kerak.

Yashirilgan URL bevosita ochilsa, umumiy `Sahifa topilmadi` ekrani chiqadi. Placeholder sifatida ishlagan `AdminResourcePage` va `/admin/:module` catch-all marshruti qayta qo‘shilmaydi.
