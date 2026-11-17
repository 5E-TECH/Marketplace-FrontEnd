# Elchi Market — lid-sotuv paneli (frontend)

Elchi Marketplace'ning lid-sotuv modelidagi paneli: 8 rol (sotuvchi, optovik,
operator, nazoratchi, omborchi, moliya, admin, superadmin) uchun yagona karkas.
Dizayn — «E» tizimi (`docs/dizayn` backend repoda): och mavzu, navy menyu, Manrope.

Backend alohida repoda: [`Elchi-Marketplace`](https://github.com/5E-TECH/Elchi-Marketplace) —
NestJS mikroservis monorepo. Bu ilova u bilan faqat HTTP kontrakt orqali
gaplashadi (`/api/v1`).

## Stack

React 19 · TypeScript · Vite 8 · Ant Design 6 · Redux Toolkit (sessiya) ·
TanStack Query (server holati) · React Router 7 · Playwright (e2e)

## Ishga tushirish (dev)

Talab: **Node 22.13+** (ESLint 10 va Vite 8 talabi).

```bash
npm install
npm run dev            # http://localhost:5273 — backendsiz, mock API bilan
npm run dev:api        # haqiqiy backend bilan (Vite proxy)
```

Loyihadagi `.npmrc` paketlarni rasmiy `registry.npmjs.org` dan o'rnatadi —
global mirror (masalan npmmirror) sozlangan bo'lsa ham `package-lock.json`
dagi manzillar aralashib ketmaydi.

### Mock API (MSW) — `npm run dev`

`npm run dev` backendsiz ishlaydi: so'rovlarni brauzerdagi MSW service worker
ushlaydi (`src/mocks`, `.env.development` → `VITE_API_MOCKS=true`). Faqat
ishga tushishga (M1) kiradigan endpointlar mock qilingan; qolganiga aniq 501
va konsolda ogohlantirish. Kirish: telefon `900000001` … `900000008` (sotuvchi,
optovik, operator, nazoratchi, omborchi, moliya, admin, superadmin), parol —
istalgan (`xato` — noto'g'ri parol); `900000009` — tanilmagan eski rol.

Mock javoblar generatsiya qilingan DTO tiplari bilan yozilgan — backend
sxemasi o'zgarsa `tsc` yiqiladi. Shu handler'lar Vitest (`msw/node`) va
Playwright (`tests/e2e/support/mockApi.ts`) da ham ishlatiladi. Mock kodi
production build'ga kirmaydi.

### Haqiqiy backend — `npm run dev:api`

API bir xil origin orqali ishlaydi: Vite `/api` ni `.env.api` dagi
`VITE_DEV_API_PROXY` ga proxy qiladi (sukut — production API, ehtiyot bo'ling).
Shu sababli CORS ham, cross-site cookie muammosi ham chiqmaydi — refresh
token to'g'ri ishlaydi. Lokal backend uchun:

```bash
echo 'VITE_DEV_API_PROXY=http://localhost:3000' >> .env.api.local
```

### Buyruqlar

| Buyruq                   | Vazifa                                            |
| ------------------------ | ------------------------------------------------- |
| `npm run dev`            | Dev server (HMR), mock API bilan                  |
| `npm run dev:api`        | Dev server, haqiqiy backend bilan                 |
| `npm run build`          | Production build (`tsc -b && vite build`)         |
| `npm run preview`        | Build natijasini lokal ko'rish                    |
| `npm run lint`           | ESLint                                            |
| `npm run typecheck`      | TypeScript tekshiruvi                             |
| `npm run contract:check` | Backend kontraktiga moslikni tekshirish           |
| `npm run api:sync`       | Backend sxemasini olish (`BACKEND_REPO=…` yoki `../Elchi-Marketplace`) |
| `npm run api:generate`   | `contract/openapi.json` dan tiplar                |
| `npm run test:unit`      | Vitest + React Testing Library (jsdom, MSW)       |
| `npm run test:e2e`       | Playwright e2e testlar (2 worker)                 |
| `npm test`               | Unit, so'ng e2e                                   |

## Tuzilma (Feature-Sliced Design)

```
src/
  app/        providers, Redux store, router: yagona marshrut manifesti
              (router/routeManifest.tsx — yo'l, rollar, menyu) va RequireRole
  features/   auth, products, orders, stock, warehouses, shop, dashboard
              (har birida: api / model / ui / lib)
  pages/      marshrutga bog'langan sahifalar
  layouts/    AppShell — barcha rollar uchun yagona karkas (karkas-E): navy menyu,
              yuqori qator (h1, til, bildirishnoma, foydalanuvchi menyusi),
              planshet/telefonda chap panel, omborchi relsi, noma'lum rol holati
  shared/     httpClient, xato ishlovchisi, umumiy UI komponentlar
```

## Responsive qoidalar

- Karkas ko'rinishi (karkas-E 4–5): telefon < 768, planshet 768–1023, desktop
  ≥ 1024; operator ish joyi va omborchi uchun desktop ≥ 1280 (omborchi
  768–1279 da 96 px relsi). Ko'rinish `data-layout` atributida.
- Karkas kontenti (`main[data-app-main]`) `content` nomli CSS container. Sahifa
  va uning komponentlari ekran emas, **kontent kengligiga** qarab moslashadi:
  `@container content (max-width: …)`.
- Faqat 4 ta breakpoint: **575** (telefon), **767** (tor), **991** (o'rta),
  **1199** (keng).
- Portal orqali `body` ga chiqadigan modal/drawer, yuqori qator va login
  sahifalari layout kontentidan tashqarida — ularda oddiy `@media` ishlatiladi.
- Jadvallar `DataTable` orqali: sig'masa ustunlar siqilmaydi, panel ichida
  gorizontal scroll bo'ladi (`scroll.x = 'max-content'`).

## Auth va sessiya

- Login `POST /auth/login` — **access token** javob tanasida, **refresh token**
  esa backend qo'yadigan HttpOnly cookie'da (`path=/api/v1/auth`).
- Access token `sessionStorage`da saqlanadi (localStorage emas: tab yopilganda
  o'chadi). JS refresh cookie'ni o'qiy olmaydi.
- Access token muddati tuganda (odatiy 1 soat) 401 javob ushlanadi,
  `POST /auth/refresh` orqali yangi token olinadi va so'rov bir marta
  qaytariladi. Refresh ham ishlamasa — sahifa yopilmaydi: ustida «Sessiya
  tugadi» oynasi chiqadi, parol bilan shu yerda qayta kiriladi va kiritilgan
  ish joyida qoladi (umumiy-sessiya).
- **Bir nechta tab** (`features/auth/lib/sessionSync.ts`): yangi tab sessiyani
  avval ochiq tabdan oladi (BroadcastChannel), bo'lmasa refresh cookie bilan
  jim tiklaydi. Backend refresh token'ni har safar almashtiradi, shuning uchun
  refresh tablar bo'ylab navbat bilan (`navigator.locks`). Bir tabda «Chiqish»
  — hamma tab chiqadi.

### Rollar

8 rol (BE-05): sotuvchi (`AFFILIATE`), optovik, operator (`OPERATOR_LEAD`),
nazoratchi, omborchi, moliya, admin, superadmin. Kim qaysi sahifani ochishi
`src/app/router/routeManifest.tsx` da (`roles`); boshqa rolning sahifasi —
403, menyuda faqat o'z bandlari (`docs/admin-navigation.md`).

## Kontrakt nazorati

E2E testlar mock javoblar ustida ishlaydi, shuning uchun backend endpointni
o'zgartirsa ular buni sezmaydi. `npm run contract:check` frontend chaqirayotgan
har bir endpointni `contract/openapi.json` bilan solishtiradi va mos kelmasa
CI'ni yiqitadi.

Sxemani yangilash (backend repo'sida):

```bash
npm run build:all && npm run contract:export
cp docs/openapi.json ../Marketplace-FrontEnd/contract/openapi.json
```

## Production

Serverga chiqarish uchun: [`DEPLOY.md`](./DEPLOY.md).

Qisqacha: SPA nginx konteynerida (8080, root emas) turadi, TLS va xavfsizlik
sarlavhalarini backend stack'idagi Caddy beradi. `main` ga push bo'lganda
GitHub Actions o'zi deploy qiladi.

> `VITE_API_URL` build vaqtida bundle ichiga yoziladi — muhit o'zgarsa
> konteynerni qaytadan build qilish kerak.
