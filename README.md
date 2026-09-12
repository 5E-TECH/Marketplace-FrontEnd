# Marketplace — sotuvchi kabineti (frontend)

Elchi Marketplace'ning sotuvchi kabineti: mahsulot va variantlar, ko'p omborli
sklad, qoldiq, buyurtmalar va Elchi orqali yetkazib berish.

Backend alohida repoda: [`Elchi-Marketplace`](https://github.com/5E-TECH/Elchi-Marketplace) —
NestJS mikroservis monorepo. Bu ilova u bilan faqat HTTP kontrakt orqali
gaplashadi (`/api/v1`).

## Stack

React 19 · TypeScript · Vite 7 · Ant Design 6 · Redux Toolkit (sessiya) ·
TanStack Query (server holati) · React Router 7 · Playwright (e2e)

## Ishga tushirish (dev)

Talab: **Node 22+**.

```bash
npm install
npm run dev            # http://localhost:5273
```

Dev'da API bir xil origin orqali ishlaydi: Vite `/api` ni
`http://localhost:3000` ga proxy qiladi (`.env.development`). Shu sababli
CORS ham, cross-site cookie muammosi ham chiqmaydi — refresh token to'g'ri
ishlaydi. Backend boshqa manzilda bo'lsa:

```bash
echo 'VITE_DEV_API_PROXY=http://192.168.1.10:3000' >> .env.local
```

### Buyruqlar

| Buyruq                   | Vazifa                                            |
| ------------------------ | ------------------------------------------------- |
| `npm run dev`            | Dev server (HMR)                                  |
| `npm run build`          | Production build (`tsc -b && vite build`)         |
| `npm run preview`        | Build natijasini lokal ko'rish                    |
| `npm run lint`           | ESLint                                            |
| `npm run typecheck`      | TypeScript tekshiruvi                             |
| `npm run contract:check` | Backend kontraktiga moslikni tekshirish           |
| `npm run test:e2e`       | Playwright e2e testlar                            |

## Tuzilma (Feature-Sliced Design)

```
src/
  app/        providers, router (rol bo'yicha kirish), Redux store
  features/   auth, products, orders, stock, warehouses, shop, dashboard
              (har birida: api / model / ui / lib)
  pages/      marshrutga bog'langan sahifalar
  layouts/    MainLayout — sidebar, header, breadcrumb
  shared/     httpClient, xato ishlovchisi, umumiy UI komponentlar
```

## Auth va sessiya

- Login `POST /auth/login` — **access token** javob tanasida, **refresh token**
  esa backend qo'yadigan HttpOnly cookie'da (`path=/api/v1/auth`).
- Access token `sessionStorage`da saqlanadi (localStorage emas: tab yopilganda
  o'chadi). JS refresh cookie'ni o'qiy olmaydi.
- Access token muddati tuganda (odatiy 1 soat) 401 javob ushlanadi,
  `POST /auth/refresh` orqali yangi token olinadi va so'rov bir marta
  qaytariladi. Refresh ham ishlamasa — sessiya yopiladi.

### Rollar

Frontend backenddagi `@Roles` chegarasini takrorlaydi:

| Rol                  | Ochiq bo'limlar                                    |
| -------------------- | -------------------------------------------------- |
| `SELLER`             | Barcha bo'limlar                                   |
| `OPERATOR`           | Buyurtmalar, Yetkazib berish, Sozlamalar, Yordam   |
| `ADMIN` | Alohida admin kabineti: dashboard, accountlar, do‘konlar, buyurtmalar va kategoriyalar |
| `SUPERADMIN` | Admin kabineti hamda qo‘shimcha moliya va jamoa bo‘limlari |

Rolga yopiq bo'lim menyuda ko'rinmaydi va yo'lga to'g'ridan-to'g'ri kirilsa
"ruxsat yo'q" holati chiqadi.

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
