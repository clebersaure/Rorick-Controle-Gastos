# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build do frontend (React + Vite)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Instala dependências antes de copiar o restante (aproveita cache de camadas)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

# Copia o código e gera o build de produção
COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Dependências de produção do backend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS backend-deps

WORKDIR /app

COPY package.json package-lock.json* ./
# --omit=dev exclui jest, nodemon e tsx — não são necessários em produção
RUN npm ci --omit=dev --silent

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Imagem final de produção
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Metadados
LABEL org.opencontainers.image.title="Rorick Controle de Gastos"
LABEL org.opencontainers.image.description="API + Bot WhatsApp para controle de gastos de obra"

# Instala dumb-init para tratamento correto de sinais POSIX (evita processos zombie)
RUN apk add --no-cache dumb-init

# Usuário sem privilégios de root
RUN addgroup -S rorick && adduser -S rorick -G rorick

WORKDIR /app

# Copia dependências de produção já instaladas
COPY --from=backend-deps /app/node_modules ./node_modules

# Copia o código-fonte do backend
COPY package.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Gera o Prisma Client — DATABASE_URL fictícia só para satisfazer o schema durante o build
# (prisma generate não conecta ao banco, apenas lê o schema)
RUN DATABASE_URL="postgresql://build:build@build:5432/build" npx prisma generate

# Copia o build estático do frontend para ser servido pelo Express (opcional)
# Se frontend estiver em serviço separado no Railway, remova estas duas linhas
COPY --from=frontend-builder /app/frontend/dist ./public

# Pasta de uploads (necessária mesmo sem arquivos iniciais)
RUN mkdir -p uploads && chown rorick:rorick uploads

# Troca para usuário não-root
USER rorick

# Porta padrão (Railway injeta PORT automaticamente)
EXPOSE 3000

# dumb-init garante que Ctrl+C / SIGTERM cheguem ao Node corretamente
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
