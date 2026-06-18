# Rorick Controle de Gastos

Sistema de controle de gastos de obra para a Rorick Engenharia, com bot WhatsApp (Z-API), OCR de notas fiscais via GPT-4o, transcrição de áudio via Whisper, e dashboard web em React.

---

## Índice

1. [Visão geral da arquitetura](#arquitetura)
2. [Configurar o ambiente de desenvolvimento](#desenvolvimento)
3. [Executar o seed](#seed)
4. [Deploy no Railway](#deploy)
5. [Adicionar um novo usuário pelo dashboard](#novo-usuario)
6. [Fluxo do bot WhatsApp](#fluxo-bot)
7. [Variáveis de ambiente](#variáveis)

---

## Arquitetura

```
WhatsApp (usuário)
    │
    ▼
Z-API (webhook) ──POST /webhook/whatsapp──► Express API (Node.js)
                                                    │
                              ┌─────────────────────┼──────────────────────┐
                              ▼                     ▼                      ▼
                        GPT-4o Vision          Whisper-1             GPT-4o-mini
                        (OCR de foto)      (áudio → texto)        (classificação)
                              │                     │                      │
                              └─────────────────────┼──────────────────────┘
                                                    ▼
                                           PostgreSQL (Prisma)
                                                    │
                                                    ▼
                                         Dashboard React (Vite)
```

**Stack:**
- **Backend:** Node.js 20 + Express 5 + Prisma 7 + PostgreSQL
- **IA:** OpenAI GPT-4o Vision, Whisper-1, GPT-4o-mini
- **WhatsApp:** Z-API (webhook)
- **Frontend:** React 19 + Vite + Recharts + TanStack Query
- **Deploy:** Railway (Dockerfile multi-stage)

---

## Desenvolvimento

### Pré-requisitos

- Node.js 20+
- PostgreSQL 15+ (local ou via Docker)
- Conta na OpenAI com acesso a GPT-4o e Whisper
- Instância Z-API configurada (opcional para desenvolvimento local)

### 1. Clone e instale dependências

```bash
git clone <url-do-repositorio>
cd Projeto_Controle_Gastos

# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com seus valores (veja a seção [Variáveis de ambiente](#variáveis)).

Para desenvolvimento, `WEBHOOK_SECRET` e `FRONTEND_URL` são opcionais.

### 3. Configure o banco de dados

```bash
# Cria/atualiza as tabelas
npx prisma migrate dev

# Gera o client Prisma
npx prisma generate
```

### 4. Execute o seed

```bash
npm run db:seed
```

Isso cria as categorias padrão e o usuário admin inicial (veja [Executar o seed](#seed)).

### 5. Inicie os servidores

Em dois terminais separados:

```bash
# Terminal 1 — Backend
npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- API: http://localhost:3000
- Dashboard: http://localhost:5173
- Health check: http://localhost:3000/health

---

## Seed

O seed popula o banco com dados iniciais obrigatórios.

```bash
npm run db:seed
```

**O que o seed cria:**

| Dado | Detalhes |
|---|---|
| Categorias | Material, Ferramentas, EPI, Alimentação, Combustível, Hospedagem, Mão de Obra, Documentação, Supervisão, Terceiros |
| Subcategorias | Vinculadas a cada categoria (ex: Cimento, Areia, Ferro → Material) |
| Usuário admin | Nome e telefone definidos em `prisma/seed.js` |

**PIN inicial do admin:** últimos 4 dígitos do número de telefone cadastrado.  
O sistema exige troca de PIN no primeiro login.

**O seed é idempotente** — pode ser executado mais de uma vez sem duplicar dados.

---

## Deploy

### Pré-requisitos

- Conta no [Railway](https://railway.app)
- Railway CLI instalado: `npm install -g @railway/cli`
- Repositório no GitHub

### 1. Crie o projeto no Railway

1. Acesse [railway.app/new](https://railway.app/new)
2. Selecione **Deploy from GitHub repo**
3. Autorize e escolha o repositório

### 2. Adicione o banco de dados

1. No projeto Railway, clique em **New** → **Database** → **PostgreSQL**
2. A variável `DATABASE_URL` é injetada automaticamente no serviço API

### 3. Configure as variáveis de ambiente da API

No Railway → serviço API → **Variables**, adicione todas as variáveis da seção [Variáveis de ambiente](#variáveis).

Gere secrets seguros:
```bash
# Gera JWT_SECRET e WEBHOOK_SECRET (execute duas vezes)
openssl rand -hex 32
```

### 4. Execute a migration de produção

Via Railway CLI:
```bash
railway login
railway link          # selecione o projeto e o serviço API
railway run npx prisma migrate deploy
railway run node prisma/seed.js
```

Ou pelo painel: **Deployments** → **Deploy Logs** → aguarde o build concluir, depois acesse o shell do serviço.

### 5. Configure o serviço Frontend

1. No Railway, clique em **New** → **GitHub Repo** (mesmo repositório)
2. Configure:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Start Command:** deixe vazio (site estático)
   - **Output Directory:** `dist`
3. Adicione a variável:
   - `VITE_API_URL` = URL pública do serviço API (ex: `https://rorick-api.up.railway.app`)

### 6. Configure o webhook no Z-API

1. Acesse o painel Z-API → sua instância → **Webhook**
2. URL: `https://<url-da-api>.railway.app/webhook/whatsapp`
3. Header personalizado: `x-webhook-secret: <valor do WEBHOOK_SECRET>`
4. Habilite: **Mensagens recebidas** (texto, imagem, áudio)
5. Desabilite: **Mensagens de grupo**

### 7. Execute o checklist de go-live

Consulte [checklist.md](./checklist.md) e marque todos os itens antes de liberar para os usuários.

---

## Novo Usuário

Para adicionar um operador pelo dashboard:

1. Acesse o dashboard e faça login com o usuário **admin**
2. No menu lateral, clique em **Usuários**
3. Clique em **Novo Usuário**
4. Preencha:
   - **Nome:** nome completo do colaborador
   - **Telefone:** número com DDI e DDD (ex: `5511999998888`), somente dígitos
   - **Perfil:** `OPERADOR` (acesso apenas ao bot) ou `ADMIN` (acesso ao dashboard)
5. Clique em **Salvar**

O colaborador já pode usar o bot WhatsApp imediatamente.  
**PIN inicial:** os 4 últimos dígitos do número cadastrado.  
O bot pedirá a troca de PIN no primeiro login via dashboard.

---

## Fluxo do Bot

```
Usuário envia foto/áudio/texto
         │
         ▼
Bot identifica o número no banco
         │
   ┌─────┴─────┐
   │ não       │ sim
   ▼           ▼
Rejeita   Processa mensagem
           │
      ┌────┼────┐
      │    │    │
    FOTO ÁUDIO TEXTO
      │    │    │
    OCR Whisper Classificador
      └────┴────┘
           │
     Pergunta obra
           │
     Mostra resumo
           │
     SIM → salva
     NÃO → cancela
```

---

## Variáveis

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NODE_ENV` | Sim | `production` em produção, `development` em dev |
| `PORT` | Não | Padrão: `3000` (Railway injeta automaticamente) |
| `DATABASE_URL` | Sim | Connection string PostgreSQL |
| `JWT_SECRET` | Sim | Secret para assinar tokens JWT (mín. 32 chars) |
| `JWT_EXPIRES_IN` | Não | Padrão: `7d` |
| `OPENAI_API_KEY` | Sim | Chave da OpenAI |
| `OPENAI_MODEL_VISION` | Não | Padrão: `gpt-4o` |
| `OPENAI_MODEL_TEXT` | Não | Padrão: `gpt-4o-mini` |
| `OPENAI_MODEL_AUDIO` | Não | Padrão: `whisper-1` |
| `ZAPI_INSTANCE_ID` | Sim | ID da instância Z-API |
| `ZAPI_TOKEN` | Sim | Token Client do Z-API |
| `ZAPI_BASE_URL` | Não | Padrão: `https://api.z-api.io/instances` |
| `WEBHOOK_SECRET` | Sim (produção) | Secret para validar requisições do Z-API |
| `FRONTEND_URL` | Sim (produção) | URL do frontend para CORS |

---

## Licença

Uso interno — Rorick Engenharia. Todos os direitos reservados.
