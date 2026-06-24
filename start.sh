#!/bin/sh
set -e

echo "[start] Aplicando migrations do banco de dados..."
npx prisma migrate deploy

echo "[start] Iniciando servidor..."
exec node src/server.js
