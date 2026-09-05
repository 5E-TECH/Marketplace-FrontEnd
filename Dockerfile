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
      echo "XATO: VITE_API_URL build-arg berilmadi (masalan https://api.example.com/api/v1)"; \
      exit 1; \
    }

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
# Unprivileged nginx: 8080 portda, root bo'lmagan foydalanuvchi ostida ishlaydi.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
