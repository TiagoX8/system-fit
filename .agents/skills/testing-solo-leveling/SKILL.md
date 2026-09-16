---
name: testing-solo-leveling
description: How to run and end-to-end test the Solo Leveling Fitness monorepo (FastAPI backend + Vite/React PWA), including how to prove scheduled Web Push works when the browser service worker cannot activate.
---

# Testing Solo Leveling Fitness

## Running the stack

```bash
sudo service postgresql start
cd backend && .venv/bin/alembic upgrade head
cd backend && .venv/bin/uvicorn app.main:app --port 8010 > /tmp/backend.log 2>&1 &
echo 'VITE_API_URL=http://127.0.0.1:8010' > frontend/.env
cd frontend && npm run dev     # http://localhost:5173
```

- Vite may warn `You are using Node.js 20.18.1. Vite requires 20.19+ or 22.12+` — it still starts and serves fine.
- If `node_modules` is reinstalled, add the optional native bindings:
  `npm install --no-save @rolldown/binding-linux-x64-gnu@1.2.6 @oxlint/binding-linux-x64-gnu@1.80.0`.
- `frontend/.env` must point at the port the backend is actually on, otherwise login silently fails on CORS.

## UI flow (pt-BR, dark "Sistema" theme)

- `/login` → "Ainda não desperto? Criar conta" switches to register (Nome / E-mail / Senha → "Despertar").
  Registering seeds 5 workouts, 4 rewards and 2 punishments for the new user.
- Nav: Status (`/dashboard`), Missões (`/treinos`), Recompensas (`/recompensas`), Registro (`/historico`).
- Gamification rules to assert: first completion of the day = **+50 XP and streak +1**; any further
  completion the same day = **+25 XP, streak unchanged**. Rank E until 300 XP.
- Editing a mission: the description input may append instead of replace — select all (`Control+A`) before typing.
- The dashboard only lists workouts scheduled for the current weekday, so pick today's weekday in the day picker
  (0=Seg … 6=Dom) when creating a test mission.

## Testing scheduled Web Push

The scheduler (`backend/app/scheduler.py`) runs every minute in `America/Sao_Paulo` (machine clock may be UTC —
always read the target time with `TZ=America/Sao_Paulo date`). It pushes to every subscription of the workout
owner, and **skips** workouts already completed today.

Chrome for Testing here fails to activate the PWA service worker
(`AbortError: ... Timed out while trying to start the Service Worker` for `dev-sw.js?dev-sw`), so
`navigator.serviceWorker.ready`, `pushManager.subscribe` and therefore `POST /push/subscribe` cannot be exercised
from the browser. This may be environmental rather than an app bug — try a production build / `vite preview`
(non-`injectManifest` dev SW) or a newer Node/Chrome before concluding the push client is broken.

Reliable workaround to prove the server half end to end: register a subscription pointing at a local HTTP
listener with a real P-256 key pair and decrypt the payload (`http_ece`, already in the backend venv). See the
pattern in a throwaway script:

1. generate `ec.generate_private_key(ec.SECP256R1())`, base64url the uncompressed point as `p256dh`, 16 random
   bytes as `auth`;
2. insert a `PushSubscription` row for the test user with `endpoint=http://127.0.0.1:8901/fake-push-endpoint`;
3. serve 201 on that endpoint and `http_ece.decrypt(body, private_key=..., auth_secret=..., version='aes128gcm')`.

Then set a mission's time a few minutes ahead and wait: the received payload should be
`{"title": "A Sistema convoca você para o treino diário", "body": "<mission> — levante-se, Caçador. ...", "url": "/dashboard"}`.
Good negative control: complete that mission and re-schedule it for a later minute — no push must arrive.

## Devin Secrets Needed

None — VAPID keys live in `backend/.env` (regenerate with `backend/generate_vapid.py`).
