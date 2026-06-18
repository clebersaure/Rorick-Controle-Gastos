# Checklist de Go-Live — Rorick Controle de Gastos

Marque cada item antes de liberar o sistema para uso em produção.

---

## 1. Infraestrutura Railway

- [ ] Serviço **API** criado no Railway e conectado ao repositório GitHub
- [ ] Serviço **Frontend** criado no Railway (root dir: `frontend/`, build: `npm run build`, output: `dist`)
- [ ] Banco de dados **PostgreSQL** provisionado no Railway e vinculado ao serviço API
- [ ] `DATABASE_URL` injetada automaticamente pelo Railway (variável do plugin Postgres)

---

## 2. Variáveis de Ambiente — Serviço API

Configure em Railway → serviço API → **Variables**:

| Variável | Exemplo / Descrição |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (Railway sobrescreve automaticamente) |
| `DATABASE_URL` | injetada pelo plugin PostgreSQL |
| `JWT_SECRET` | string aleatória ≥ 32 chars (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `7d` |
| `OPENAI_API_KEY` | `sk-proj-...` |
| `OPENAI_MODEL_VISION` | `gpt-4o` |
| `OPENAI_MODEL_TEXT` | `gpt-4o-mini` |
| `OPENAI_MODEL_AUDIO` | `whisper-1` |
| `ZAPI_INSTANCE_ID` | ID da instância no Z-API |
| `ZAPI_TOKEN` | Token Client do Z-API |
| `ZAPI_BASE_URL` | `https://api.z-api.io/instances` |
| `WEBHOOK_SECRET` | string aleatória ≥ 32 chars (`openssl rand -hex 32`) |
| `FRONTEND_URL` | URL pública do serviço Frontend (ex: `https://rorick.up.railway.app`) |

- [ ] Todas as variáveis acima estão configuradas no Railway
- [ ] `JWT_SECRET` e `WEBHOOK_SECRET` têm pelo menos 32 caracteres
- [ ] Nenhuma variável está hardcoded no código ou no `railway.toml`

---

## 3. Variáveis de Ambiente — Serviço Frontend

| Variável | Valor |
|---|---|
| `VITE_API_URL` | URL pública da API (ex: `https://rorick-api.up.railway.app`) |

- [ ] `VITE_API_URL` configurada no Railway → serviço Frontend

---

## 4. Banco de Dados

- [ ] Migration de produção executada:
  ```bash
  # via Railway CLI ou console do serviço
  npx prisma migrate deploy
  ```
- [ ] Seed executado com categorias e usuário admin inicial:
  ```bash
  node prisma/seed.js
  ```
- [ ] Confirmado que o seed não duplica dados (verificar com `SELECT * FROM "Usuario"`)
- [ ] Backup automático habilitado no plugin PostgreSQL do Railway

---

## 5. Configuração do Z-API

- [ ] Instância Z-API conectada ao número de WhatsApp da Rorick (QR Code escaneado)
- [ ] Status da instância: **Connected** no painel Z-API
- [ ] Webhook URL atualizado no Z-API para a URL de produção:
  ```
  https://<url-da-api>.railway.app/webhook/whatsapp
  ```
- [ ] Header do webhook configurado: `x-webhook-secret: <valor do WEBHOOK_SECRET>`
- [ ] Tipos de mensagem habilitados no webhook: **Texto**, **Imagem**, **Áudio**
- [ ] Mensagens de grupo **desabilitadas** no webhook

---

## 6. Testes Funcionais

Execute os testes abaixo antes de liberar para os usuários:

### 6.1 Health check da API
- [ ] `GET https://<url-api>/health` retorna `{"status":"ok","db":"ok"}`

### 6.2 Login no dashboard
- [ ] Acessar `https://<url-frontend>` no navegador
- [ ] Login com o número do admin e PIN inicial (últimos 4 dígitos do telefone)
- [ ] Sistema solicita troca de PIN no primeiro acesso
- [ ] Dashboard carrega com gráficos (mesmo sem dados ainda)

### 6.3 Cadastro de usuário operador
- [ ] Acessar dashboard → Usuários → Novo usuário
- [ ] Criar um usuário operador com número de teste
- [ ] Confirmar que o número aparece na lista de ativos

### 6.4 Fluxo WhatsApp — foto de nota
- [ ] Enviar foto de um cupom fiscal do número de teste cadastrado
- [ ] Bot responde com dados extraídos (valor, data, categoria)
- [ ] Informar código de obra (ex: `001`) ou `GERAL`
- [ ] Bot envia confirmação — responder `SIM`
- [ ] Gasto aparece no dashboard com o ID correto

### 6.5 Fluxo WhatsApp — áudio
- [ ] Enviar mensagem de áudio descrevendo um gasto (ex: "Gasolina 80 reais")
- [ ] Bot transcreve e classifica corretamente
- [ ] Confirmar com `SIM` — gasto registrado

### 6.6 Fluxo WhatsApp — número não cadastrado
- [ ] Enviar mensagem de um número não cadastrado
- [ ] Bot responde que o número não está autorizado
- [ ] Admin recebe notificação no WhatsApp

### 6.7 Rate limiting
- [ ] Tentar login 11 vezes seguidas com PIN errado → 11ª tentativa retorna HTTP 429
- [ ] Aguardar 15 minutos → login liberado novamente

### 6.8 Webhook security
- [ ] `POST /webhook/whatsapp` sem header `x-webhook-secret` → HTTP 403
- [ ] `POST /webhook/whatsapp?secret=qualquer_coisa` → HTTP 403
- [ ] `POST /webhook/whatsapp` com header correto → HTTP 200

---

## 7. Segurança Final

- [ ] `.env` **não** está no repositório (verificar com `git log --all -- .env`)
- [ ] `git log` não contém credenciais em nenhum commit anterior
- [ ] HTTPS ativo na URL do Railway (automático — verificar cadeado no browser)
- [ ] CORS restrito ao domínio do frontend (não `*`)
- [ ] Webhook acessível apenas via HTTPS

---

## 8. Monitoramento

- [ ] Logs do serviço API visíveis no Railway → Deployments → Logs
- [ ] `/health` configurado como healthcheck no `railway.toml` ✓
- [ ] Alertas de falha de deploy habilitados no Railway (Settings → Notifications)

---

## Aprovação Final

| Responsável | Data | Assinatura |
|---|---|---|
| | | |

**Sistema liberado para produção em:** ___________
