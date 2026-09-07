# Solo Leveling Fitness — Backend

API FastAPI que gerencia usuários, treinos em casa, logs diários, gamificação
(XP, streak, ranks, recompensas e penalidades) e lembretes por Web Push.

## Requisitos

- Python 3.10+
- PostgreSQL

## Instalação

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Variáveis de ambiente

| Variável | Descrição |
| -------- | --------- |
| `DATABASE_URL` | conexão do PostgreSQL |
| `SECRET_KEY` | segredo do JWT (HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | validade do token, padrão 1440 |
| `ALLOWED_ORIGINS` | origens do CORS separadas por vírgula |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | chaves do Web Push (`python generate_vapid.py`) |
| `VAPID_SUBJECT` | `mailto:seu@email.com` |
| `SCHEDULER_TIMEZONE` | fuso usado pelos lembretes |
| `SCHEDULER_ENABLED` | `false` desliga o APScheduler interno (lembretes via cron externo) |
| `CRON_SECRET` | token do header `X-Cron-Secret` de `POST /push/dispatch` |
| `FORCE_HTTPS` | `true` em produção: redireciona http→https e envia HSTS |
| `RATE_LIMIT_ENABLED` | `false` desliga o rate limit por IP |
| `RATE_LIMIT_PER_MINUTE` | requisições/min por IP, padrão 60 |
| `AUTH_RATE_LIMIT_PER_MINUTE` | requisições/min por IP em `/auth/login` e `/auth/register`, padrão 10 |
| `GEMINI_API_KEY` | chave do Gemini para `POST /coach/chat`; vazio desativa o Conselheiro |
| `GEMINI_MODEL` | modelo usado, padrão `gemini-3.6-flash` |
| `COACH_MESSAGES_PER_DAY` | mensagens do Conselheiro por usuário por dia, padrão 40 |

## Migrations (Alembic)

```bash
alembic upgrade head                              # aplica
alembic revision --autogenerate -m "mensagem"     # nova migration
```

O `alembic/env.py` lê a `DATABASE_URL` do ambiente.

## Executando

```bash
uvicorn app.main:app --reload
```

## Estrutura

```
app/
  database.py      engine/SessionLocal/Base
  dependencies.py  get_db e get_current_user (Authorization: Bearer)
  security.py      bcrypt + JWT (create_access_token / decode_access_token)
  models.py        User, Workout, WorkoutLog, Progress, Reward, Punishment, PushSubscription
  schemas.py       Pydantic
  gamification.py  XP, ranks, streak, seed, recompensas e penalidades
  push.py          envio de Web Push (pywebpush)
  hardening.py     headers de segurança (CSP, nosniff, HSTS) e HTTPS obrigatório
  ratelimit.py     middleware de rate limit por IP (429)
  scheduler.py     APScheduler: lembretes no horário do treino
  main.py          app FastAPI, CORS e routers
  routes/          auth, workouts, logs, progress, rewards, push
alembic/           migrations
```

## Endpoints

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| POST | `/auth/register` | cria usuário e semeia treinos/recompensas/penalidades |
| POST | `/auth/login` | `{ access_token, token_type, user: { id, email, name } }` |
| GET  | `/auth/me` | usuário autenticado |
| GET/POST | `/workouts/` | lista/cria treinos |
| PUT/DELETE | `/workouts/{id}` | edita/remove |
| POST | `/workouts/{id}/complete` | conclui o treino do dia |
| GET | `/logs/` | histórico de conclusões |
| GET | `/progress/` | rank, XP, streak, recorde, semanas, recompensas e penalidades |
| GET/POST | `/rewards/` e `/punishments/` | listagem (com avaliação) e criação |
| PUT/DELETE | `/rewards/{id}` e `/punishments/{id}` | edita/remove (mudar a meta rearma o item) |
| GET | `/push/public-key` | chave pública VAPID |
| POST | `/push/subscribe` | salva a subscription do navegador |
| POST | `/push/test` | envia uma notificação de teste |
| POST | `/push/dispatch` | cron externo: envia os lembretes vencidos na janela (`window_minutes`) |

Todas as rotas (exceto `/auth/*` e `/push/public-key`) exigem
`Authorization: Bearer <token>` e são escopadas pelo `user_id` do token.

## Gamificação

- 50 XP por treino concluído (metade para treinos extras no mesmo dia).
- Ranks por XP: E (0), D (750), C (2000), B (4500), A (9000), S (16000),
  Monarca das Sombras (30000).
- Streak aumenta quando houve conclusão no dia anterior; ao pular dias o Sistema
  reseta o streak, reduz XP e marca a penalidade correspondente.
- Recompensas desbloqueiam em 1, 2, 4 e 12 semanas consecutivas.

## Web Push

O scheduler roda a cada minuto e envia o lembrete "A Sistema convoca você para o
treino diário" no `scheduled_time` de cada treino ainda não concluído no dia.
Funciona em Android/desktop; no iOS exige iOS 16.4+ com o site instalado como PWA.

Em hospedagem gratuita que hiberna o processo, defina `SCHEDULER_ENABLED=false` e chame
`POST /push/dispatch?window_minutes=6` a cada 5 minutos com o header `X-Cron-Secret`
(ver `DEPLOY.md` na raiz).
