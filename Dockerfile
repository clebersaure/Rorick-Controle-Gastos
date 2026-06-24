# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build do frontend (React + Vite)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Dependências de produção do backend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS backend-deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --silent

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Imagem final de produção
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

LABEL org.opencontainers.image.title="Rorick Controle de Gastos"

RUN apk add --no-cache dumb-init

RUN addgroup -S rorick && adduser -S rorick -G rorick

WORKDIR /app

COPY --from=backend-deps /app/node_modules ./node_modules

COPY package.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
COPY start.sh ./

# prisma generate não precisa conectar ao banco — apenas lê o schema
RUN npx prisma generate

COPY --from=frontend-builder /app/frontend/dist ./public

RUN mkdir -p uploads && chown rorick:rorick uploads && chmod +x start.sh

USER rorick

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
# start.sh roda 'prisma migrate deploy' com DATABASE_URL real do Railway,
# depois inicia o servidor
CMD ["sh", "start.sh"]
