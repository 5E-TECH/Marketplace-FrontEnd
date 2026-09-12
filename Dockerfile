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

# Domen hali yo'q va API HTTP orqali sinalayotgan bo'lsa `true`.
# Aks holda production build HTTPS talab qiladi va xato bilan to'xtaydi.
ARG VITE_ALLOW_INSECURE_API=false
ENV VITE_ALLOW_INSECURE_API=${VITE_ALLOW_INSECURE_API}
RUN test -n "$VITE_API_URL" || { \
      echo "XATO: VITE_API_URL build-arg berilmadi (masalan https://api.elchimarket.uz/api/v1)"; \
      exit 1; \
    }

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
# Unprivileged nginx: 8080 portda, root bo'lmagan foydalanuvchi ostida ishlaydi.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
