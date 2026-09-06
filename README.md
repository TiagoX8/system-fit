# Leveling Fitness

Monorepo de um app full-stack de treinos em casa gamificado no estilo "Sistema" de Solo Leveling:
rank E → S → Monarca das Sombras, XP, streak diário, recompensas por semanas consecutivas,
penalidades ao falhar e lembretes por Web Push no horário do treino.

```
backend/    API FastAPI + PostgreSQL + Alembic + APScheduler + pywebpush
frontend/   React 19 + Vite + TypeScript + auth-lite-react + PWA (vite-plugin-pwa)
```

## Stack

| Camada   | Tecnologias |
| -------- | ----------- |
| Backend  | FastAPI, SQLAlchemy, Alembic, PostgreSQL, python-jose (JWT HS256), bcrypt, APScheduler, pywebpush |
| Frontend | React 19, Vite, TypeScript, react-router-dom, [`auth-lite-react`](https://www.npmjs.com/package/auth-lite-react), vite-plugin-pwa |

## Rodando o backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # ajuste as variáveis
alembic upgrade head
uvicorn app.main:app --reload
```

API em `http://127.0.0.1:8000` e docs em `http://127.0.0.1:8000/docs`.

### Variáveis (`backend/.env`)

| Variável | Descrição |
| -------- | --------- |
| `DATABASE_URL` | ex. `postgresql://postgres:postgres@localhost:5432/solo_leveling` |
| `SECRET_KEY` | chave de assinatura do JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | validade do token (padrão 1440) |
| `ALLOWED_ORIGINS` | origens do CORS, separadas por vírgula (ex. `http://localhost:5173`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | chaves do Web Push |
| `VAPID_SUBJECT` | `mailto:seu@email.com` |
| `SCHEDULER_TIMEZONE` | fuso dos lembretes (padrão `America/Sao_Paulo`) |

### Gerando as chaves VAPID

```bash
source .venv/bin/activate
python generate_vapid.py
```

Cole as duas linhas no `.env`. A chave pública também é servida em `GET /push/public-key`
para o frontend montar a subscription.

## Rodando o frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://127.0.0.1:8000
npm run dev                # http://localhost:5173
npm run build              # typecheck (tsc -b) + build + service worker
npm run lint
```

## Fluxo do app

1. **Registro/Login** — `auth-lite-react` consome `POST /auth/login`, que devolve
   `{ access_token, token_type, user: { id, email, name } }` com claim `exp` no JWT.
   No registro o Sistema já semeia treinos livres (flexões, agachamentos, prancha,
   abdominais, burpees), recompensas e penalidades.
2. **Missões** — CRUD de treinos com horário do lembrete e dias da semana.
3. **Concluir treino** — `POST /workouts/{id}/complete` grava o log do dia, soma XP,
   atualiza streak e rank e libera recompensas.
4. **Status** — `GET /progress/` devolve rank, XP, streak, recorde, semanas completas
   e o próximo rank.
5. **Penalidade** — ao quebrar a sequência, o Sistema reseta o streak, reduz XP e
   marca a punição correspondente.

## Conselheiro do Sistema (IA)

Chat de dúvidas sobre exercícios em `/conselheiro`, servido por `POST /coach/chat`
(autenticado). O backend chama o Gemini com `GEMINI_API_KEY` — a chave fica só no
servidor, o navegador nunca fala com o Google. Sem a chave o endpoint responde 503 e a
tela mostra o Conselheiro como offline.

- Chave gratuita (sem cartão): https://aistudio.google.com/apikey
- No Render: Environment → `GEMINI_API_KEY`. Localmente, `backend/.env`.
- Além do rate limit por IP, cada usuário tem `COACH_MESSAGES_PER_DAY` mensagens (40)
  para não estourar a cota gratuita.

## Web Push

- O frontend registra o service worker (`frontend/src/sw.ts`), pede permissão de
  notificação após o login e envia a subscription para `POST /push/subscribe`.
- O APScheduler roda a cada minuto e, no `scheduled_time` de cada treino ainda não
  concluído no dia, dispara "A Sistema convoca você para o treino diário".
- `POST /push/test` envia uma notificação imediata para testar.

**Limitações:** Web Push funciona em Android e desktop (Chrome, Edge, Firefox).
No iOS é necessário iOS 16.4+ **e** instalar o site como PWA ("Adicionar à Tela de
Início"); notificações no Safari em aba comum não são entregues. Também é preciso
servir o app por HTTPS (ou `localhost`).

## Deploy

Passo a passo gratuito (Neon + Render + Vercel + cron do GitHub Actions) em [DEPLOY.md](DEPLOY.md).

Em hospedagem que hiberna o serviço, use `SCHEDULER_ENABLED=false` e deixe os lembretes por
conta de `POST /push/dispatch?window_minutes=6` (header `X-Cron-Secret: $CRON_SECRET`),
chamado pelo workflow `.github/workflows/push-reminders.yml`.
