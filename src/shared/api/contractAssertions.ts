/**
 * Kontrakt qo'riqchisi (C5.6).
 *
 * Bu faylda ishlaydigan kod yo'q — faqat kompilyatsiya vaqtidagi tekshiruvlar.
 * Har bir qo'lda yozilgan model tipi backend DTO'siga taqqoslanadi: backendda
 * maydon nomi o'zgarsa yoki maydon o'chirilsa, `tsc` shu yerda yiqiladi va
 * CI qizil bo'ladi.
 *
 * Nega kerak: `check-contract.mjs` faqat endpoint YO'Lini biladi. Endpoint
 * o'z joyida turib, javob ichidagi maydon `ownerId` dan `sellerId` ga
 * o'zgarsa, u sezmaydi — e2e testlar esa mock javoblar ustida ishlagani
 * uchun ular ham yashil qolaveradi. Xato faqat productionda chiqardi.
 *
 * Sxema eskirganda tartib:
 *   npm run api:sync && npm run api:generate
 * So'ng shu fayldagi xatolarni ko'rib chiqish: yo model tipini backendga
 * moslash, yo (agar maydon ataylab frontend tomonida hosil qilinsa) uni
 * quyidagi `Derived*` ro'yxatiga sabab bilan qo'shish.
 */
import type { components } from '../../generated/api-types';
import type { Category } from '../../features/categories/model/categoryTypes';
import type { Product, ProductVariant } from '../../features/products/model/productTypes';
import type { AuthUser } from '../../features/auth/model/authTypes';
import type { StockItem } from '../../features/stock/model/stockTypes';
import type { Warehouse } from '../../features/warehouses/model/warehouseTypes';

type Schemas = components['schemas'];

/**
 * App tipida bor, lekin backend DTO'sida yo'q maydonlar. Bo'sh bo'lishi shart.
 * Aksi tekshirilmaydi: backend qo'shimcha maydon qaytarsa frontend uni
 * e'tiborsiz qoldiraveradi — bu buzuvchi o'zgarish emas.
 */
type MissingInBackend<App, Dto, Derived extends keyof App = never> = Exclude<
  Exclude<keyof App, Derived>,
  keyof Dto
>;

type ExpectNoDrift<App, Dto, Derived extends keyof App = never> = [
  MissingInBackend<App, Dto, Derived>,
] extends [never]
  ? true
  : {
      XATO: 'Backend DTO da bu maydonlar yo‘q — model tipi eskirgan';
      maydonlar: MissingInBackend<App, Dto, Derived>;
    };

/** `true` dan boshqa hamma narsa kompilyatsiya xatosi beradi. */
type Check<T extends true> = T;

/**
 * `Product` da backenddan kelmaydigan maydonlar. Har biri `productApi.ts`
 * dagi `parseProduct` ichida hosil qilinadi:
 *
 * - `sku`      — `ProductDto` da yo'q; `sku` bo'lmasa `slug` ishlatiladi.
 * - `category` — DTO faqat `categoryId` beradi; nomi ro'yxatdan qo'shiladi.
 * - `stock`    — DTO da umuman yo'q, zaxira qiymat `0`. DIQQAT: qoldiq
 *                inventory-service'da, alohida so'rov bilan olinadi.
 * - `isDeleted`, `variants` — jonli API ularni QAYTARADI, lekin Nest surati
 *                ularni `ProductDto` ga kiritmagan (sxema haqiqatdan kambag'al).
 */
type ProductDerived = 'sku' | 'category' | 'stock' | 'isDeleted' | 'variants';

/**
 * `AuthUser.isBlocked` — `AuthUserDto` da yo'q. Foydalanuvchi jadvalida
 * `is_blocked` ustuni bor (identity migratsiyasi), lekin DTO uni oshkor
 * qilmaydi; frontend yo'q bo'lsa `false` deb hisoblaydi.
 */
type AuthUserDerived = 'isBlocked';

// prettier-ignore
type _Category  = Check<ExpectNoDrift<Category,       Schemas['CategoryTreeDto']>>;
// prettier-ignore
type _Product   = Check<ExpectNoDrift<Product,        Schemas['ProductDto'], ProductDerived>>;
// prettier-ignore
type _Variant   = Check<ExpectNoDrift<ProductVariant, Schemas['ProductVariantDto']>>;
// prettier-ignore
type _AuthUser  = Check<ExpectNoDrift<AuthUser,       Schemas['AuthUserDto'], AuthUserDerived>>;
// prettier-ignore
type _StockItem = Check<ExpectNoDrift<StockItem,      Schemas['StockItemDto']>>;
// prettier-ignore
type _Warehouse = Check<ExpectNoDrift<Warehouse,      Schemas['WarehouseDto']>>;

/**
 * Faqat tipdan iborat fayl modul bo'lib qolishi va yuqoridagi tekshiruvlar
 * "ishlatilmagan" deb hisoblanmasligi uchun. Union emas, tuple: hammasi
 * `true` ga aylangani uchun union takrorlanuvchi bo'lib qolardi.
 */
export type ContractGuarded = [
  _Category,
  _Product,
  _Variant,
  _AuthUser,
  _StockItem,
  _Warehouse,
];
