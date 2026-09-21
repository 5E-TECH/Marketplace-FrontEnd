# ── Build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite API manzilini build vaqtida bundle ichiga yozadi — shuning uchun bu
# build-arg majburiy. Bo'sh qolsa ilova noto'g'ri manzilga so'rov yuborardi.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN test -n "$VITE_API_URL" || { \
      echo "XATO: VITE_API_URL build-arg berilmadi (masalan https://api.elchimarket.uz/api/v1)"; \
      exit 1; \
    }

# HTTPS darvozasi BUILD vaqtida (C5.3). Ilgari tekshiruv faqat runtime'da
# ishlardi — ya'ni http:// manzil bilan build yashil chiqib, nosozlik faqat
# brauzerda bilinardi. Nisbiy manzilga (`/api/v1`) ataylab ruxsat beriladi:
# uni httpClient.ts qo'llab-quvvatlaydi va u bir xil origin demakdir.
RUN case "$VITE_API_URL" in \
      https://*|/*) ;; \
      *) echo "XATO: VITE_API_URL https:// yoki nisbiy (/api/v1) bo'lishi kerak, berilgani: $VITE_API_URL"; exit 1 ;; \
    esac

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
# Unprivileged nginx: 8080 portda, root bo'lmagan foydalanuvchi ostida ishlaydi.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
