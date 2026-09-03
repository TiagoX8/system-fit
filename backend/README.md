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
| GET | `/rewards/` e `/punishments/` | listagem e avaliação |
| GET | `/push/public-key` | chave pública VAPID |
| POST | `/push/subscribe` | salva a subscription do navegador |
| POST | `/push/test` | envia uma notificação de teste |
| POST | `/push/dispatch` | cron externo: envia os lembretes vencidos na janela (`window_minutes`) |

Todas as rotas (exceto `/auth/*` e `/push/public-key`) exigem
`Authorization: Bearer <token>` e são escopadas pelo `user_id` do token.

## Gamificação

- 50 XP por treino concluído (metade para treinos extras no mesmo dia).
- Ranks por XP: E (0), D (300), C (800), B (1600), A (3000), S (5000),
  Monarca das Sombras (10000).
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
