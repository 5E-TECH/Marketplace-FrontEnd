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
import type { AuthUser, UpdateAuthProfilePayload } from '../../features/auth/model/authTypes';

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
 * `AuthUser.isBlocked` — `AuthUserDto` da yo'q. Foydalanuvchi jadvalida
 * `is_blocked` ustuni bor (identity migratsiyasi), lekin DTO uni oshkor
 * qilmaydi; frontend yo'q bo'lsa `false` deb hisoblaydi.
 */
type AuthUserDerived = 'isBlocked';

/**
 * FE-12 taklifi (docs/api-taklif/fe-12-admin-moderatsiya.md, 9-bo'lim): kategoriyaning BAD va «muddat kuzatiladi»
 * belgilari — backend qo'shguncha ixtiyoriy, kelmasa ota kategoriyadan yoki sukut.
 */
type CategoryDerived = 'isBad' | 'expiryTracked';

// prettier-ignore
type _Category  = Check<ExpectNoDrift<Category,       Schemas['CategoryTreeDto'], CategoryDerived>>;
// prettier-ignore
type _AuthUser  = Check<ExpectNoDrift<AuthUser,       Schemas['AuthUserDto'], AuthUserDerived>>;
// So'rov tanasi: `UpdateProfileDto` da yo'q maydon (masalan `email`) yuborilmasin.
// prettier-ignore
type _UpdateProfile = Check<ExpectNoDrift<UpdateAuthProfilePayload, Schemas['UpdateProfileDto']>>;

/**
 * Faqat tipdan iborat fayl modul bo'lib qolishi va yuqoridagi tekshiruvlar
 * "ishlatilmagan" deb hisoblanmasligi uchun. Union emas, tuple: hammasi
 * `true` ga aylangani uchun union takrorlanuvchi bo'lib qolardi.
 */
export type ContractGuarded = [
  _Category,
  _AuthUser,
  _UpdateProfile,
];
