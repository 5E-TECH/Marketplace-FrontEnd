# FE-15: admin — foydalanuvchilar va rollar — API va taklif

**Holat:** frontend backend `dev` bc9e6e0 dagi foydalanuvchi endpointlariga ulangan (BE-05 rollar, BE-26 2FA, BE-27
audit). Bu yo'llar uchun `contract/openapi.json` backend bilan bir xil; `dev` 4a7b767 (2026-11-27) da ham o'zgarmagan. Mock: `src/mocks/handlers/staff.ts`. Kirish
hisoblari `src/mocks/fixtures/users.ts` da, dizayn namunasidagi xodimlar `src/mocks/fixtures/staff.ts` da.

Mock **taklif bo'yicha** ishlaydi: masalan, admin ham xodim qo'shadi. Backenddagi hozirgi farq har bo'limda yozilgan.

**Taklif maydon backendda bo'lmasa:**
- Javobda kelmasa — ekranda «—» chiqadi.
- So'rovdagi taklif maydonini backend rad etsa (`forbidNonWhitelisted` → 400), so'rov ularsiz qayta yuboriladi
  (`withOptionalBody`, `withOptionalParams`).
- Taklif endpointi 404 bersa — blok «ma'lumot yo'q» deydi, sahifa xato bermaydi.

**Dizayn:**
- Panel 2: `admin-foydalanuvchilar`, `admin-foydalanuvchi-karta`, `admin-rollar`, `admin-operatorlar-jamoasi`.
- Panel 1: `nazoratchi-jamoa`, `umumiy-sessiya`.
- Xabarlar: `xabar-xodim-hisobi`.

## 1. Ishlatilgan endpointlar

| Amal | Yo'l | Kim | Izoh |
|---|---|---|---|
| Ro'yxat | `GET /admin/users` | ADMIN, SUPERADMIN | Parametrlar: `role` (bitta), `blocked`, `search` (ism yoki telefon), `page`, `limit` ≤ 100. Saralash yo'q (yangisi tepada). SUPERADMIN yashirin |
| Karta | `GET /admin/users/{id}` | ADMIN, SUPERADMIN | Topilmasa **409** (404 emas) |
| Xodim qo'shish | `POST /admin/team` | **faqat SUPERADMIN** | Tana: `{name, phone, role, password?}`. Javob 201 + `temporaryPassword` (bir marta). Band telefon — 409 |
| Rol | `PATCH /admin/users/{id}/role` `{role}` | **faqat SUPERADMIN** | Rol o'zgarsa `authVersion`+1, hamma sessiya bekor, audit `user.role.update` `{before, after}`. Oxirgi superadmin — 409 |
| Bloklash / blokdan chiqarish | `POST /admin/users/{id}/block`, `…/unblock` | ADMIN, SUPERADMIN | Tana yo'q, javob 201. O'zini — 409. Admin va superadminni faqat superadmin bloklaydi (403) |
| 2FA tiklash | `POST /admin/users/{id}/2fa/reset` | **faqat SUPERADMIN** | Sir va zaxira kodlar o'chadi, sessiyalar bekor, audit `user.2fa.reset` |
| Audit | `GET /admin/audit` | ADMIN, SUPERADMIN | Filtrlar: `actorId`, `action`, `entityType`, `entityId`, sanalar. Kartadagi «Oxirgi amallari» va rol tarixi shundan |
| Nomidan kirish | `POST /admin/users/{id}/impersonate` | **faqat SUPERADMIN** | Faqat AFFILIATE va WHOLESALER (boshqasi — 403). O'zi yoki bloklangan/faol bo'lmagan hisob — 409. Javob 200: `{impersonationToken, expiresIn: 900, expiresAt, user}`; token refresh qilinmaydi, audit `user.impersonate` |

**Xodimlar ro'yxati.** Backendda «hamma xodim» filtri yo'q, shuning uchun frontend har xodim roli uchun
`GET /admin/users?role=X` ni alohida so'raydi (`limit=100`, sahifalab). Bu backendda hozir ishlaydi.

**Bloklash va rol o'zgarishi «darhol»** — backendda bor. `CurrentRoleGuard` har so'rovda `authVersion` ni
tekshiradi, shuning uchun eski access token keyingi so'rovda 401 «Token bekor qilingan, qayta tizimga kiring» oladi.
Refresh bunday javob beradi:
- bloklangan hisobda — 401 «Hisob faol emas»;
- sessiyalar bekor qilingan bo'lsa — 401 «Sessiya bekor qilingan».

## 2. Xodim qo'shish va rol berish — admin ham

Karta («Admin xodim hisoblarini yaratadi, rol beradi») va TZ ADM-3 bo'yicha xodimni admin ochadi. Dizaynda ham shunday:
admin Nodira K. «Xodim qo'shish» va «Rol berish» ni ishlatadi, «Superadmin» varianti o'chiq — «faqat superadmin beradi».
Backendda esa `/admin/team` (hammasi) va `PATCH …/role` faqat superadmin uchun ochiq.

**Taklif — ADMIN uchun ruxsat:**
- `POST /admin/team` — SUPERADMIN rolidan boshqa istalgan xodim roli bilan.
- `PATCH /admin/users/{id}/role`:
  - nishon admin yoki superadmin bo'lmasa;
  - yangi rol SUPERADMIN bo'lmasa;
  - o'z roli emas.

Bularni superadmin o'zgartiradi. Superadmin o'z rolini ham o'zgartira oladi; u oxirgi superadmin bo'lsa — 409,
backenddagidek.

Hozirgi backendda admin bu amallarni bajarsa 403 oladi va ekran backend xabarini ko'rsatadi.

**Qo'shimcha maydonlar (taklif):**

| Maydon | Qayerda | Nima uchun |
|---|---|---|
| `firstName`, `lastName` | `POST /admin/team` tanasi; ro'yxat va karta javobi | Formada «Ism *» va «Familiya *» alohida. `name` = «Ism Familiya» har doim yuboriladi |
| `teamId` | `POST /admin/team`, `PATCH …/role` tanasi | Operator jamoasi (§8). Faqat `OPERATOR_LEAD` uchun |
| `existingUser {id, name}` | 409 «Bu telefon allaqachon ro‘yxatdan o‘tgan» javobi | Xato matni: «Bu raqam bilan hisob bor: Laylo N. (U-2087)» |

Backend kuzatuvi: dublikat telefon tekshiruvida `isDeleted` filtri yo'q, shuning uchun o'chirilgan xodim raqamini qayta
ishlatib bo'lmaydi.

## 3. Ro'yxat va karta — qo'shimcha maydonlar

Dizayndagi ustunlar: «Oxirgi kirish», «Ikki bosqichli kirish», «Hali kirmagan» holati, jamoa. Karta qatorlari: «Qo‘shilgan
… · kim», «Parol … da o‘rnatilgan», blok sababi. Backend `AdminUserDto` da bular yo'q.

**Taklif — `GET /admin/users` elementi va `GET /admin/users/{id}`:**

| Maydon | Shakl | Ekranda |
|---|---|---|
| `lastLoginAt` | ISO, `null` — hali kirmagan | «Oxirgi kirish», holat «Hali kirmagan» |
| `createdBy` | `{id, name}` \| `null` | «Qo‘shilgan: 26.12.2026 · Akmal S.» (hozir faqat audit `admin.team.create` dan topiladi) |
| `passwordSetAt` | ISO | «Parol: … da o‘rnatilgan» |
| `temporaryPassword` | `{issuedAt, smsSentAt}` \| `null` | «Hisob ochildi — xodim hali kirmagan», «vaqtinchalik · bugun, 14:52» |
| `twoFactorReset` | `{at, by}` \| `null` | «Tiklandi — qayta ulanmagan · 14:20 · Akmal S.» |
| `block` | `{at, by, reason}` \| `null` | «Bloklangan: 10.01.2027, 18:30 · Nodira K. Sabab: …» |
| `team` | `{id, supervisorId, supervisorName}` \| `null` | Guruh sarlavhasi «jamoa: nazoratchi Rustam Q.», kartadagi «Operator ish joyi» |

**Ro'yxat parametrlari (taklif):**
- `role=SUPERADMIN` aniq so'ralsa, superadminlar qaytsin. Hozir har doim yashirin, «Superadmin · 1» guruhi bo'sh qoladi.
- `unknownRole=true` — roli frontendga noma'lum hisoblar («Noma’lum rol» banneri). Backend rad etsa (400), banner
  chiqmaydi.
- `search` ID bo'yicha ham ishlasin (dizayn: «Ism, telefon yoki ID»).

## 4. Vaqtinchalik parol va SMS

**Dizayn** (`xabar-xodim-hisobi`, karta K1/K2): «Vaqtinchalik parol SMS bilan shu raqamga boradi»; admin parolni ko'rmaydi.

**Backend:** SMS yubormaydi, `temporaryPassword` ni javobda qaytaradi.

**Frontend:**
- javobda `smsSent: true` (taklif) bo'lsa, parol ko'rsatilmaydi;
- aks holda parol adminga **bir marta** ko'rsatiladi (dizayndagi «Vaqtinchalik parolni menga ko'rsatish» varianti). Bu
  bo'lmasa xodim umuman kira olmaydi.

**Taklif:**
- `POST /admin/team` vaqtinchalik parolni SMS bilan yuborsin va `smsSent: true` qaytarsin. SMS matni —
  `xabar-xodim-hisobi` (rol, panel manzili, vaqtinchalik parol; admin, moliya va superadminga «Keyin ilovadagi kodni
  ulaysiz»).
- `POST /admin/users/{id}/welcome-sms` → `{sentAt}` — kartadagi «SMS ni qayta yuborish». Faqat hali kirmagan xodimga,
  aks holda 409.
- Birinchi kirishda parolni almashtirish — `umumiy-parol` taxtasi **chizilmagan** (kartada «Hali chizilmagan»). Backendda
  `mustChangePassword` ham yo'q. Frontend bu ekranni qurmaydi, xodim vaqtinchalik parol bilan kiradi.

## 5. Bloklash — sabab va sessiyalar

**Sabab (taklif).**
- `POST /admin/users/{id}/block` tanasida `{reason}` yuboriladi; dizaynda «Sabab *» majburiy, «audit jurnaliga yoziladi».
- Backend tanani o'qimaydi (DTO yo'q), shuning uchun so'rov hozir ham o'tadi, sabab esa saqlanmaydi.
- Taklif: sabab audit `user.block` meta siga va kartadagi `block.reason` ga yozilsin.
- Hozir `user.block` / `user.unblock` auditi «best-effort» (gateway, fire-and-forget) va unda `before/after` yo'q.

**Sessiyalar.**
- Backend blokda faqat `authVersion` ni oshiradi va refresh sessiyalarini bekor qilmaydi.
- Natijada blokdan chiqarilgach eski (7 kundan yosh) refresh token yana ishlaydi.
- Dizayn: «Bloklanganda hamma sessiya tugadi», «Blokdan chiqarilsa, eski parol bilan kiradi».
- Taklif: blokda sessiyalar ham bekor qilinsin.

**Operator.**
- Bloklangan operatorning `operator_state` holati o'zgarmaydi (masalan, ONLINE qoladi).
- U `queue-summary` da ko'rinadi, nazoratchi unga lid o'tkaza oladi.
- Taklif: blokda holat OFFLINE bo'lsin; bronlari va rejalashtirilgan qo'ng'iroqlari — 17-qaror.

## 6. Parolni tiklash (admin)

Dizayn (karta D4) da «Parolni tiklash» oynasi bor, unda ikki variant: «Vaqtinchalik parolni SMS bilan yuborish» yoki
«Vaqtinchalik parolni menga ko'rsatish». Backendda adminning parol tiklash endpointi yo'q.

**Taklif:** `POST /admin/users/{id}/password/reset` `{delivery: 'SMS' | 'SHOW'}` → `{temporaryPassword: string | null, smsSent}`.
- Eski parol darhol ishlamaydi, hamma sessiya tugaydi (`authVersion`+1, sessiyalar bekor), audit `user.password.reset`.
- O'z paroli — «Mening profilim»da (403).
- Admin va superadmin parolini — faqat superadmin (13-qaror, taklif). Dizaynda admin moliya parolini tiklaydi.

## 7. Sessiyalar va kirishlar tarixi

Dizayn (karta) da ikki blok bor:
- «Faol sessiyalar» — qurilma, IP, kirgan payt va oxirgi faollik; «Tugatish» va «Hammasini tugatish».
- «Kirishlar tarixi» — oxirgi 5 ta.

Backendda faqat o'z sessiyalari bor (`GET /auth/sessions`).

**Taklif:**

| Amal | Yo'l | Javob |
|---|---|---|
| Sessiyalar | `GET /admin/users/{id}/sessions` | `[{id, browser, os, ip, createdAt, lastSeenAt, current}]` (`current` — so'rayotganning o'z joriy sessiyasi) |
| Bittasini tugatish | `DELETE /admin/users/{id}/sessions/{sessionId}` | `{id, revoked: true}`; o'sha qurilma keyingi so'rovda chiqadi |
| Hammasini tugatish | `DELETE /admin/users/{id}/sessions` | `{revoked: true}`; `authVersion`+1 |
| Kirishlar tarixi | `GET /admin/users/{id}/logins?limit=5` | `[{at, outcome: SUCCESS \| WRONG_PASSWORD \| WRONG_CODE \| BLOCKED, method: PASSWORD \| PASSWORD_CODE \| RECOVERY_CODE \| SMS, browser, os, ip}]` |

O'z sessiyalari va o'z kartasi uchun bu amallar 403 qaytaradi — ular «Mening profilim»da. Audit: `user.session.revoke`.

## 8. Operatorlar jamoasi

Backendda jamoa ham, nazoratchi biriktirish ham yo'q: navbat umumiy, nazoratchi hamma operatorni ko'radi.

Dizaynda esa jamoa bor:
- «Rol berish» va «Yangi xodim» da operator uchun «Jamoa» tanlovi;
- ro'yxat guruhida «jamoa: nazoratchi Rustam Q.»;
- «Operatorlar jamoasi» tabi.

**Taklif:**
- `GET /admin/teams` → `[{id, supervisor: {id, name}, operatorCount, createdAt}]`.
- Operatorga jamoa — `teamId` (§2).

Lidlar jamoaga bo'linmaydi; jamoa faqat nazoratchi kimni kuzatishini belgilaydi. `/admin/teams` 404 bersa, jamoa
tanlovi chiqmaydi.

## 9. 2FA tiklash — sabab

D5 oynasida «Sabab *» maydoni bor: «Xodim ekanini avval telefon orqali tekshiring. Sabab audit jurnaliga yoziladi».

- Tanada `{reason}` yuboriladi; backend uni o'qimaydi (DTO yo'q).
- Taklif: sabab audit `user.2fa.reset` meta siga yozilsin.
- Backend kuzatuvi: tiklashda o'z hisobi va xodim bo'lmagan hisob tekshirilmaydi.

## 10. Backend kuzatuvlari

- `GET /admin/users/{id}` va `POST …/block|unblock` topilmagan foydalanuvchiga 409 qaytaradi, `PATCH …/role` esa 404.
  Bir xil bo'lsin (404).
- `POST …/block|unblock` 201 qaytaradi; 200 kutiladi (`@HttpCode`).
- `POST /admin/users/{id}/impersonate` faqat sotuvchi va optovik uchun, xodim uchun emas.
- `docs/C6.1-ADMIN-TEAM.md` va `docs/C6.5-USER-ACCESS.md` eski rollarni (SELLER, BUYER, OPERATOR) yozadi.

## 11. «Sotuvchilar» va «Optoviklar» yorliqlari

Dizayn (`admin-foydalanuvchilar.holatlar` «Tablar») bu yorliqlarda hisobni ko'rsatadi: kirish, holat va bloklash.
Lidlar, balans va jazolar «Sotuvchilar» bo'limida qoladi.

**Sotuvchilar** — `GET /admin/users?role=AFFILIATE&page&limit=10`. Backendda bor: ism, telefon, blok, sahifalash.

Taklif — sotuvchi elementiga qo'shimcha maydonlar:
- `lastLoginAt` — §3 dagi bilan bir xil;
- `affiliate: {streams, stoppedStreams}` — sahifalar soni: «3 sahifa», «1 sahifa to'xtatilgan»;
- `sanction: {kind: "WARNING" | "HOLD", since} | null` — «Ogohlantirilgan» yoki «Haqi ushlangan», qachondan.
  Qiymat «Sotuvchilar» bo'limidagi holat bilan bir xil bo'ladi;
- `block: {at, by, reason}` — §5 dagi bilan bir xil; ekranda «bloklangan 12.01.2027 dan».

Taklif — ro'yxat parametrlari:
- `sanction=NONE|WARNING|HOLD` — holat filtri. «Faol» uchun `blocked=false&sanction=NONE`, «Bloklangan» uchun
  `blocked=true` (bu backendda bor). Backend `sanction` ni rad etsa (400), so'rov parametrsiz qayta yuboriladi va
  kelgan sahifa joyida saralanadi; jami — shu sahifadagilar soni.
- `search` sahifa (oqim) kodi bo'yicha ham qidirsin. Joy egasi: «Ism, telefon yoki sahifa kodi».
- `role=AFFILIATE` ro'yxati `lastLoginAt` bo'yicha kamayish tartibida bo'lsin, hali kirmaganlar oxirida. Ustun
  sarlavhasida shu tartib ko'rsatiladi.

Taklif — sotuvchi bloklanganda (`POST …/block`) sahifalari ham to'xtatilsin, firibgarlik qaroridagi
`BLOCK_AFFILIATE` kabi. Bloklash oynasida «Sahifalari to'xtatiladi — yangi buyurtma qabul qilmaydi» deb yoziladi.
Hozir oddiy blok faqat kirishni yopadi, lid qabul qilish davom etadi.

Sotuvchi parol bilan kirmaydi (telefon va SMS kod). Shuning uchun blokdan chiqarish toastida «Parolni tiklash» yo'q.

**Optoviklar** — FE-25 ro'yxatidan (`GET /admin/wholesalers`): egasi bog'langan (`ownerUserId`) yoki kabinetga taklif
yuborilgan (`cabinet`, fe-25 taklifi) optoviklar. Ko'rsatiladi: «Kim kiradi» (rahbar, telefon), holat, kabinet ochilgan
payt va oxirgi faollik. Yorliqdagi son — `GET /admin/users?role=WHOLESALER` ning `total` i.

**Nomidan kirish** — sotuvchi va optovik qator menyusida, faqat superadmin va faqat faol hisob uchun. Tasdiq oynasidan
keyin kabinet 15 daqiqaga ochiladi. «Chiqish» bosilsa yoki muddat tugasa, admin shu yorliqqa qaytadi.

## 12. «Rollar va ruxsatlar» yorlig'i

Yangi endpoint kerak emas: dizaynga ko'ra (`admin-rollar`) yorliq faqat ko'rish uchun, ruxsatlar tizimda belgilangan.

- **Ruxsatlar matritsasi** frontendda statik (`features/staff/model/permissions.ts`). U backend `@Roles` guard'lari va
  TZ 3 jadvali bilan bir xil. Backendda rol yoki ruxsat o'zgarsa, shu fayl ham yangilanadi.
- **Menyu** («19 band · M1 da 13», rol panelidagi bandlar) karkas-E §2 rejasidan olinadi
  (`features/staff/model/menuPlan.ts`). M1 bandlari marshrut manifesti bilan bir xil ekani unit testda tekshiriladi.
- **Sonlar** — `GET /admin/users` dan. Xodimlar har rol bo'yicha olinadi, sotuvchi va optovik — `total` dan.
  Superadmin backend ro'yxatida yashirin (§3 taklifi: `role=SUPERADMIN`). U kelmasa, son o'rnida «—» va
  «ro'yxatda ko'rinmaydi» chiqadi.
- **«Rol … da berilgan — auditda bor»** — `GET /admin/audit?entityType=User&entityId={id}` dagi oxirgi
  `user.role.update`, `admin.team.role.update` yoki `admin.team.create` yozuvi (`meta.after.role`). Bu backendda bor.
- **«Audit: rol va bloklash»** havolasi audit jurnalini `?entityType=User` bilan ochadi (backend filtri bor).

## 13. «Operatorlar jamoasi» yorlig'i

Dizayn: `admin-operatorlar-jamoasi` (+ .planshet, .mobil, .holatlar).

**Backendda bor (dev 4a7b767):**
- `GET /operator/queue-summary` (ADMIN va SUPERADMIN ham oladi). Har operator uchun: `state` (ONLINE, BREAK, OFFLINE),
  `activeBookings`, `maxBookings`, `scheduledCalls`, `activity` (`kind`, `leadId`, `since`). «Hozir» va «Bronlar»
  ustunlari shundan olinadi. Ro'yxatda yo'q operator oflayn hisoblanadi.
- `GET|PUT|DELETE /admin/operators/{id}/phone` (BE-15): ichki raqam yoki mobil.

**Taklif:**
1. `queue-summary` operatoriga `since` — holat qachondan boshlangan («13:15 dan», «tanaffus 22 daq»). Operatorning
   o'z holatida (`OperatorStateDto.since`) bu maydon allaqachon bor.
2. `GET /admin/operators/softphones` → `[{operatorId, account, status, since, workspace, neverConnected, pendingWorkspace}]`.
   - `status`: `REGISTERED` — SIP serverda ro'yxatda; `UNREGISTERED` — ulanmagan; `DISABLED` — bloklanganda o'chirilgan.
   - `workspace`: `BROWSER` (WebRTC), `SIP` (stol telefoni). `APP` (mobil ilova) — 2-bosqich.
   - `account` — operator ID sidan. BE-15 dagi ichki raqam (EXTENSION) bilan bir xil bo'lishi mumkin.
3. `PATCH /admin/operators/{id}/softphone` `{workspace}` → yangi holat. Operator suhbatda bo'lsa, o'zgarish suhbat
   tugagach kuchga kiradi (`pendingWorkspace`). `APP` → 400 (2-bosqich). Audit: `operator.softphone.update`
   `{before, after}`.
4. `GET /admin/operators/stats?from&to` (Toshkent sanasi) → `[{operatorId, attempts, confirmed, valid, approveRate,
   firstCallMedianMinutes}]`. Bu `lead.stats.operator` ning admin uchun ro'yxat ko'rinishi. Qo'shimcha `valid` — tasdiq
   foizi maxraji (yaroqli lidlar). Davr: «Bugun» yoki «Oxirgi 7 kun».
5. `PATCH /admin/users/{id}/team` `{teamId | null}` — operatorni jamoaga biriktirish yoki jamoadan chiqarish.
   Faqat OPERATOR_LEAD. Audit: `user.team.update`.
6. `POST /admin/teams` `{supervisorId}` va `PATCH /admin/teams/{id}` `{supervisorId}`. Nazoratchi — faol, SUPERVISOR
   roli bor xodim. Uning boshqa jamoasi bo'lsa — 409. Audit: `team.create`, `team.supervisor.update`.
7. `POST /admin/team` operator uchun `workspace` ni qabul qilsin. Softfon hisobi operator bilan birga ochiladi.

**Backendda yo'q bo'lsa:**
- Softfon va ko'rsatkichlar endpointlari 404 bersa, ustunlarda «—» chiqadi.
- `GET /admin/teams` 404 bersa, «Hali jamoa yo'q» va jamoasiz operatorlar ro'yxati ko'rsatiladi.
- Biriktirish, jamoa yaratish va ish joyini saqlash backendda yo'q bo'lsa, xato toast bilan aytiladi.

**Hali qaror kutayotgan dizayn belgilari:** `[SIP server — EQ-02]`, `[qayerga o'tadi — 17-qaror]` (bloklangan
operatorning bronlari). «Jamoa yaratish» va «Nazoratchini almashtirish» oynalari chizilmagan — «Jamoaga biriktirish»
uslubida qurildi.

## 14. Nazoratchining «Jamoa» yorlig'i (`/supervisor/operators?tab=team`)

Dizayn: `nazoratchi-jamoa` (+ .planshet, .mobil, .holatlar). 15-qaror hali ochiq. Asosiy variant qurildi: jamoa
tarkibini nazoratchi yuritadi. «Faqat ko'rish» varianti ham chizilgan — qaror o'zgarsa, amallar yopiladi.

**Backendda bor:**
- `queue-summary` — SUPERVISOR ham oladi. Undan «Hozir» ustuni olinadi.
- Foydalanuvchining `isActive` maydoni va `identity.user.set-active` RPC. Refresh nofaol hisobni rad etadi
  («Hisob faol emas»).

**Backendda yo'q.** Nazoratchi uchun jamoa endpointlari umuman yo'q. `/admin/users` va `/admin/team` faqat ADMIN va
SUPERADMIN uchun.

**Taklif:**
1. `GET /supervisor/team` → `{team: {id, supervisorId, supervisorName} | null, operators: [...]}`. Har operator:
   `AdminUserDto` maydonlari, `lastLoginAt`, `createdBy`, `softphone` (§13 shakli), `inactive {at, by, reason}`,
   `request {kind: BLOCK | UNBLOCK, at, by, reason}`, `block {at, by, reason}` (admin bloklagan bo'lsa). Faqat shu
   nazoratchining jamoasi qaytadi. Jamoa bo'lmasa — `team: null`.
2. `POST /supervisor/team/operators` `{firstName, lastName, phone, workspace}` → yangi operator, faqat o'z jamoasiga.
   Javob `POST /admin/team` bilan bir xil: `temporaryPassword` va `smsSent`. Band telefon — 409 `existingUser`.
   Audit: `supervisor.operator.create`.
3. `PATCH /supervisor/team/operators/{id}` `{firstName, lastName, phone, workspace}`. Bloklangan operator — 409.
   Ish joyi suhbat paytida o'zgarsa — suhbat tugagach kuchga kiradi (§13). Audit: `supervisor.operator.update`
   `{before, after}`.
4. `POST …/{id}/deactivate` `{reason}`: `isActive=false`, sessiyalar bekor, softfon to'xtatiladi, navbatdan lid
   olmaydi. Operator suhbatda bo'lsa — 409 `OPERATOR_IN_CALL`. `POST …/{id}/activate` — qaytaradi. Audit:
   `supervisor.operator.deactivate`, `supervisor.operator.activate`.
5. `POST …/{id}/block-request` `{reason, deactivate}` va `POST …/{id}/unblock-request` `{reason}`. So'rov admin'ga
   bildirishnoma bo'lib boradi. Javob kelguncha holat «Bloklash so'ralgan». `deactivate: true` bo'lsa, operator
   javobgacha nofaol qilinadi. Admin `POST /admin/users/{id}/block|unblock` qilganda so'rov yopiladi. Audit:
   `supervisor.block.request`, `supervisor.unblock.request`.
6. `POST …/{id}/welcome-sms` — hali kirmagan operatorga vaqtinchalik parolni qayta yuborish (§4 bilan bir xil).
7. `GET …/{id}/history` → shu operator ustidagi audit yozuvlari. Qator menyusidagi «O'zgarishlar tarixi» uchun.
8. `POST /auth/login` nofaol hisobni ham rad etsin (401 «Hisob faol emas»). Hozir faqat refresh rad etadi.

**Dizayndagi ochiq belgilar:**
- `[qayerga o'tadi — 17-qaror]` — nofaol qilinganda bronlar qayerga o'tadi.
- `[sana]`, `[sabab]` — admin blokining sanasi va sababi nazoratchiga ko'rinadimi. Backend `block` ni bersa, haqiqiy
  qiymat chiqadi.
- «Hozirgi holatini ko'rish» bandi «Hozir» yorlig'iga (FE-11) `?operator=` bilan o'tadi.
- «O'zgarishlar tarixi» oynasi chizilmagan — oddiy ro'yxat.


## 15. Hisob yopilganda va rol o'zgarganda — foydalanuvchi ekranlari

Dizayn: `umumiy-sessiya.holatlar` 3, 6–9, 12, 14–15 va `umumiy-kirish.holatlar` 12. Qoida: blok va rol «keyingi
so'rovda darhol (401)».

**Ekranlar:**
- Sahifa ochiq turganda hisob bloklansa yoki nofaol qilinsa — sahifa ustida majburiy oyna «Hisobingiz bloklandi»
  (× yo'q). «Chiqish» — kirish sahifasi. «Batafsil» — karkassiz sahifa `/account-blocked`.
- Sotuvchi bloklangan bo'lsa, SMS kod bilan kirganda ham shu karkassiz sahifa ochiladi.
- Xodim bloklangan yoki nofaol bo'lsa, kirish sahifasida forma o'rnida sabab kartasi chiqadi (umumiy-kirish 12).
- O'sha odam qayta kirsa va roli boshqa bo'lsa — karkassiz «Rolingiz o‘zgardi» sahifasi. «Ish joyini ochish»
  yangi rolning bosh sahifasini ochadi.
- Admin, superadmin va moliya «Sessiya tugadi» oynasida parolni kiritgach, ilovadagi kodni ham kiritadi (2/2).

**Backendda bor.**
- Blok: keyingi so'rov 401 «Token bekor qilingan, qayta tizimga kiring».
- Blok: refresh 401 «Hisob faol emas».
- Blok: login 401 «Hisobingiz bloklangan».
- Rol o'zgarsa sessiyalar bekor qilinadi, refresh 401 «Sessiya bekor qilingan».
- Hamma javobda `errorCode` bir xil — `UNAUTHENTICATED`.

**Frontend backendning hozirgi javobi bilan:**
- Login javobi «Hisobingiz bloklangan» bo'lsa — blok sifatida ko'rsatiladi. Sabab va sana yo'q, «Hisob» qatorida
  kiritilgan raqam chiqadi.
- Refresh javobi «Hisob faol emas» bo'lsa — blokmi yoki nofaolmi, ajratib bo'lmaydi. Shuning uchun oddiy «Sessiya
  tugadi» oynasi chiqadi. Parol kiritilgach, login «Hisobingiz bloklangan» desa — «Hisobingiz bloklandi» oynasi.
- Sotuvchida SMS kod — 404 «hisob topilmadi» (blok oshkor qilinmaydi), ya'ni o'zgarish yo'q.
- Rol o'zgarishini frontend o'zi aniqlaydi: shu tabda oxirgi ko'rilgan hisob (ID va rol) qayta kirgandagi rol bilan
  solishtiriladi. Bu backendsiz ham ishlaydi.
- «Oldin» va «Endi» qatorlari doim chiqadi. «Jamoa» va «O'zgartirdi» qatorlari faqat backend bersa chiqadi.

**Taklif:**

1. Hisob yopilgani uchun 401 javobiga alohida `errorCode` va `account` tafsiloti qo'shilsin. Javob login, refresh,
   `POST /auth/otp/verify` va `POST /auth/2fa/verify` da beriladi — faqat parol yoki kod to'g'ri bo'lgach, shunda
   blok begona odamga oshkor bo'lmaydi.

   ```json
   {
     "statusCode": 401,
     "errorCode": "ACCOUNT_BLOCKED",
     "message": "Hisobingiz bloklangan",
     "account": {
       "id": "U-0110", "name": "Bobur Yoqubov", "role": "AFFILIATE",
       "at": "2027-01-12T10:10:00Z",
       "by": { "name": "Nodira Karimova", "role": "ADMIN" },
       "reason": "Aldovli reklama", "evidence": "Kreativ o‘chirildi", "basis": "oferta",
       "supervisorName": null,
       "seller": { "pagesStopped": true, "heldBonus": { "amount": 0, "cancelled": true }, "balance": 0 }
     }
   }
   ```

   | Maydon | Ekranda |
   |---|---|
   | `at` | «12.01.2027, 15:10 · admin qarori», «Admin 12.01.2027, 15:10 da hisobingizni blokladi» |
   | `by.role` | «admin qarori» yoki «nazoratchi qarori» |
   | `reason`, `evidence`, `basis` | «Sabab», «Dalil», «Asos»; oynada «Aldovli reklama — kreativ o‘chirildi», «Asos — oferta» |
   | `supervisorName` | Operatorda: «Nazoratchi», «Savol bo‘lsa: nazoratchingiz Rustam Q.» |
   | `seller.pagesStopped` | «Sahifalaringiz — yangi ariza qabul qilmaydi» (§11: blok sahifalarni to'xtatadi) |
   | `seller.heldBonus` | «Ushlab turilgan haq — bekor qilindi · 0 so‘m» (`cancelled: false` — «ushlab turiladi») |
   | `seller.balance` | «Mavjud balans» |

2. Nazoratchi nofaol qilgan hisob (§14) uchun ham shunday javob, faqat `errorCode` boshqa: `ACCOUNT_INACTIVE`.
   Unda `at`, `by` (nazoratchi), `reason` va `supervisorName` beriladi. Hozir refresh ikkalasiga ham «Hisob faol
   emas» deydi.
3. Sotuvchida `POST /auth/otp/send` bloklangan hisobga ham kod yuborsin. To'g'ri kod raqam egasi ekanini isbotlagach,
   `otp/verify` 1-banddagi javobni bersin. Hozir `otp/send` 404 «hisob topilmadi» qaytaradi — sotuvchi blok sababini
   hech qachon ko'rmaydi.
4. `GET /auth/me` ga ikki maydon qo'shilsin:
   - `roleChange: {before, after, at, by: {name, role}} | null` — oxirgi rol o'zgarishi. Audit `user.role.update`
     dan olinadi. «O'zgartirdi: Nodira K. · admin, 14:41» uchun.
   - `team: {id, supervisorName} | null` — operator jamoasi. «Jamoa: nazoratchi Rustam Q.» uchun.

**Mock:** `accountLockResponse` (`src/mocks/handlers/auth.ts`) — login, refresh va SMS kodda. `/auth/me` da
`roleChange` va `team` bor. Rol o'zgarganda `PATCH /admin/users/{id}/role` `roleChange` ni yozadi.

**Dizayndagi ochiq belgilar:**
- `[murojaat kanali — TZ’da yo‘q]` — sotuvchi qarorga e'tirozni qayerga yuboradi. Sahifada shunday qoldirilgan.
- «Ishingiz saqlanib turibdi» (3, 12-kadrlar) — saqlanmagan ishni eslab qolish. Bu FE-02 ishi (umumiy-sessiya 4),
  2FA qadamida hozircha yo'q.
- Nofaol hisob ekrani chizilmagan. U bloklangan xodim ko'rinishida qurilgan: «Hisobingiz nofaol», «nazoratchi qarori».
