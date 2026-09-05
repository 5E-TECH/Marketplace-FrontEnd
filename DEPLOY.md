# Deploy — sotuvchi kabineti

SPA `nginx` konteynerida 8080 portda (root bo'lmagan foydalanuvchi ostida)
ishlaydi. TLS sertifikati, HSTS va CSP kabi sarlavhalarni **backend
stack'idagi Caddy** beradi va `marketplace_edge` tarmog'i orqali shu
konteynerga proxy qiladi.

Domen bor bo'lsa:

```
Internet ──► Caddy (backend stack, :443)
               ├── {$DOMAIN}      ──► api-gateway:3000
               └── {$APP_DOMAIN}  ──► frontend:8080   ← shu repo
```

Domen hali yo'q bo'lsa SPA to'g'ridan-to'g'ri o'z portida ochiladi:

```
Internet ──► :8080 ──► frontend konteyneri     (SPA)
Internet ──► :80   ──► Caddy ──► api-gateway   (API)
```

Bu holda `.env.production` da `VITE_ALLOW_INSECURE_API=true` bo'lishi shart,
aks holda production build HTTPS talab qilib to'xtaydi. Token va parollar
shifrlanmagan ketadi — faqat sinov uchun.

## Bir marta bajariladigan sozlash

### 1. DNS

`APP_DOMAIN` (masalan `kabinet.marketplace.uz`) server IP'siga A yozuvi.

### 2. Backend tomonda

`Elchi-Marketplace/.env.production` ichida:

```env
APP_DOMAIN=kabinet.marketplace.uz
CORS_ORIGINS=https://kabinet.marketplace.uz
```

So'ng backend stack'ini ko'taring — u `marketplace_edge` tarmog'ini yaratadi:

```bash
cd /srv/marketplace
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### 3. Frontend muhiti

Serverda `/home/deploy/marketplace-frontend/.env.production`:

```env
VITE_API_URL=https://api.marketplace.uz/api/v1
```

> Bu qiymat build vaqtida bundle ichiga yoziladi. O'zgartirsangiz konteynerni
> `--build` bilan qayta ko'taring.

### 4. GitHub Actions sirlari

`Settings → Secrets and variables → Actions`:

| Secret               | Qiymat                                           |
| -------------------- | ------------------------------------------------ |
| `DEPLOY_HOST`        | Server IP yoki domeni                            |
| `DEPLOY_USER`        | SSH foydalanuvchi                                |
| `DEPLOY_SSH_KEY`     | Xususiy kalit, **base64** ko'rinishida           |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -H <host>` natijasi                 |

```bash
base64 -w0 ~/.ssh/deploy_key      # DEPLOY_SSH_KEY
ssh-keyscan -H marketplace.uz     # DEPLOY_KNOWN_HOSTS
```

## Avtomatik deploy

`main` ga push bo'lganda CI: lint → tiplar → kontrakt → build → nginx konfi →
e2e. Hammasi o'tsa, `deploy-production` job fayllarni serverga yuboradi,
konteynerni qayta quradi va `/healthz` javob berishini tekshiradi.

## Qo'lda deploy

```bash
cd /home/deploy/marketplace-frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Tekshirish

```bash
curl -I https://kabinet.marketplace.uz                     # 200 + HSTS + CSP
curl -s https://api.marketplace.uz/api/v1/health/ready | jq # ok / degraded
docker compose -f docker-compose.prod.yml logs -f frontend
```

## Orqaga qaytarish

```bash
cd /home/deploy/marketplace-frontend
git checkout <oldingi-commit>
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Ko'p uchraydigan xatolar

| Belgi                              | Sabab va yechim                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Caddy `502 Bad Gateway`            | Frontend konteyneri ko'tarilmagan yoki `marketplace_edge` tarmog'ida emas    |
| `network marketplace_edge not found`| Avval backend stack'ini ko'taring                                            |
| Brauzerda CORS xatosi              | Backend `.env.production` da `CORS_ORIGINS` ga `APP_DOMAIN` qo'shilmagan     |
| Login ishlaydi, 1 soatdan keyin chiqib ketadi | `CORS_ORIGINS` aniq domen emas — cookie yuborilmayapti (credentials kerak) |
| Build `VITE_API_URL` xatosi        | `.env.production` da manzil yo'q yoki `https://` bilan boshlanmagan          |
