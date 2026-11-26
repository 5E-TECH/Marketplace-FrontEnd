# FE-27 — login 2FA: backendga takliflar (BE-26)

Dizayn: Panel 1 — `umumiy-2fa`, `umumiy-2fa-ulash` (+ `.planshet`, `.mobil`, `.holatlar`). Backend: `dev` bc9e6e0
(BE-26), `apps/identity-service/src/two-factor/*`, `apps/api-gateway/src/auth/auth.controller.ts`.

## 1. Ishlatilgan endpointlar (backendda bor)

| Qadam | Yo'l | Izoh |
|---|---|---|
| Parol | `POST /auth/login` | `ADMIN_2FA=on` va rol ADMIN, SUPERADMIN, FINANCE → `{twoFactorRequired, twoFactorSetupRequired, challengeToken}` (cookie yo'q, token 5 daqiqa) |
| Ulash | `POST /auth/2fa/setup {challengeToken}` | `{secret, otpauthUrl}`; ulangan bo'lsa 409. QR — `otpauthUrl` dan (antd `QRCode`) |
| Yoqish | `POST /auth/2fa/enable {challengeToken, code}` | `{recoveryCodes, accessToken}` + cookie; zaxira kodlar faqat shu javobda |
| Kirish | `POST /auth/2fa/verify {challengeToken, code? \| recoveryCode?}` | `{accessToken}` + cookie |
| Tiklash | `POST /admin/users/{id}/2fa/reset` | faqat SUPERADMIN (ekran — FE-15) |

Xatolar: 401 — kod noto'g'ri yoki bosqich muddati o'tdi (matn bilan ajratiladi), 423 `RATE_LIMITED` — 3 xato →
15 daqiqa, 429 — throttle 5/daqiqa, 400 — kod 6 raqam emas.

Zaxira kodlar: backend 8 ta, 10 belgili base32 (tiresiz) beradi — dizayndagi 10 ta «XXXX-XXXX» o'rniga ekranda
backend bergani ko'rsatiladi («K7QM2-XPA4D» ko'rinishida). Kiritishda tire, bo'shliq olib tashlanadi va katta harfga
o'tkaziladi — backend kodni aynan kelganidek HMAC qiladi.

## 2. Login javobida: kim kirayapti va tiklanganmi

Kod oynasi kartasi: «Nodira K. · Admin · Parol tekshirildi»; ulash oynasida — «2FA tiklandi: Superadmin Akmal S.
14.01.2027, 14:20 da eski ilovangizni uzdi».

| Maydon (`TwoFactorChallengeResultDto`) | Nima uchun | Kelmasa |
|---|---|---|
| `user {name, role}` | kartadagi ism va rol | telefon raqami va «Xodim» |
| `reset {by, at}` (faqat `twoFactorSetupRequired`) | «2FA tiklandi» xabari; birinchi kirishda `null` | umumiy «Avval ulagan edingizmi?» eslatmasi |

## 3. Xato kod va blok: qolgan urinishlar va vaqt

Dizayn: «Kod noto'g'ri … Yana 2 ta urinish qoldi», blokda taymer «14:05».

| Maydon | Qayerda | Kelmasa |
|---|---|---|
| `attemptsLeft` (401 tanasida, SMS kod qoidasi kabi — `extra.attemptsLeft`) | xato matni | ekran shu bosqichdagi xatolarni o'zi sanaydi (3 tadan) |
| `retryAfterSeconds` (423 tanasida) va `Retry-After` sarlavhasi | blok taymeri | 15:00 dan boshlanadi |
| alohida `errorCode` (`TWO_FACTOR_INVALID`, `TWO_FACTOR_CHALLENGE_EXPIRED`) | matnga bog'lanmasdan ajratish | 401 matni bo'yicha («muddati o'tdi») |

## 4. Ilovani ulash: bosqich muddati va `setup`

Ulash ekrani (umumiy-2fa-ulash) bitta `challengeToken` bilan ishlaydi: «Avval ilovani ulang» → `POST /auth/2fa/setup`
(QR, kalit) → ilova o'rnatiladi va skanerlanadi → `POST /auth/2fa/enable`. Hozir bosqich 5 daqiqa yashaydi, ilovani
do'kondan o'rnatishga esa ko'pincha shundan ko'p vaqt ketadi. Muddat o'tsa, foydalanuvchi parolni qayta kiritadi,
`setup` yangi sir yozadi va ilovaga qo'shilgan hisob endi ishlamaydi — QR ni qaytadan skanerlash kerak bo'ladi.

| Taklif | Nima uchun | Hozir frontend |
|---|---|---|
| `setup` dan keyin bosqich muddati 15 daqiqaga uzaytirilsin (yoki `setup` javobida yangi `challengeToken` bersin) | ilova o'rnatishga vaqt yetsin | muddat o'tsa — parol bosqichiga «Kod kiritish vaqti tugadi» bilan |
| 2FA hali yoqilmagan bo'lsa, `setup` qayta chaqirilganda mavjud sir qaytarilsin (yangisi yozilmasin) | ikkinchi tab yoki qayta kirish skanerlangan hisobni buzmasin | `setup` ekranda bir marta so'raladi (kesh kaliti — bosqich tokeni) |

## 5. Dizayndan farqlar (backend ustun)

- **Ilovadagi hisob nomi.** Dizayn: «[brend] · Ozoda B.». Backend `otpauthUrl` yorlig'i — `Elchi Marketplace:+998…`
  (telefon). Ekranda ilovada aynan chiqadigani ko'rsatiladi: «Elchi Marketplace · +998 90 000 00 06».
- **Kalit uzunligi.** Dizaynda 20 belgi («MZXW 6YTB OI4D QNBR 7KPA»), backend sirri 20 bayt — 32 belgi. Kalit to'rtlik
  guruhlarda, sig'masa guruhlar orasida keyingi qatorga o'tadi.
- **Zaxira kodlar profilda yo'q.** Dizayndagi «Kodlar «Mening profilim» da ham turadi» matni backendga mos emas: BE-26
  kodlarni HMAC bilan saqlaydi va faqat `enable` javobida bir marta qaytaradi. «Kodlarni saqladingizmi?» oynasida:
  «Kodlar faqat hozir ko'rsatiladi — keyin ularni qayta ko'rib bo'lmaydi». Profildan yangi kodlar olish — 5-qism taklifi.
