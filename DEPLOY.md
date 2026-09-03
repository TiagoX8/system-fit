# Deploy gratuito (Neon + Render + Vercel + GitHub Actions)

Todos os serviços abaixo têm plano gratuito permanente. O único ponto de atenção é que o
Render free hiberna o serviço após ~15 min sem tráfego — por isso os lembretes são
disparados por um cron do GitHub Actions (`.github/workflows/push-reminders.yml`), que
acorda a API e envia os pushes vencidos.

## 1. Banco — Neon

1. Crie um projeto em https://neon.tech (free tier).
2. Copie a connection string (`postgresql://...?sslmode=require`) — será a `DATABASE_URL`.

## 2. Chaves VAPID

Localmente, com o venv do backend ativo:

```bash
cd backend && python generate_vapid.py
```

Guarde `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.

## 3. Backend — Render

1. https://dashboard.render.com → **New → Blueprint** e aponte para este repositório
   (o `render.yaml` na raiz já define o serviço free com root `backend/`).
2. Preencha as variáveis marcadas como "sync: false":
   - `DATABASE_URL` (Neon)
   - `ALLOWED_ORIGINS` (URL do frontend na Vercel, ex. `https://system-fit.vercel.app`)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:seu@email.com`)
3. `SECRET_KEY` e `CRON_SECRET` são gerados automaticamente — copie o valor de `CRON_SECRET`
   (aba Environment) para usar no passo 5.
4. O build roda `alembic upgrade head`, então o schema é criado no primeiro deploy.

Sem blueprint dá no mesmo: **New → Web Service**, root directory `backend`, build
`pip install -r requirements.txt && alembic upgrade head`, start
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, e as mesmas variáveis com
`SCHEDULER_ENABLED=false`.

## 4. Frontend — Vercel

1. https://vercel.com → **Add New → Project**, importe o repositório.
2. **Root Directory**: `frontend` (o `vercel.json` cuida do resto).
3. Variável de ambiente: `VITE_API_URL` = URL do serviço no Render
   (ex. `https://system-fit-api.onrender.com`, sem barra no final).
4. Depois do primeiro deploy, volte no Render e ajuste `ALLOWED_ORIGINS` para a URL final
   da Vercel (inclua também o domínio de preview se for usar).

## 5. Lembretes — GitHub Actions

No repositório, **Settings → Secrets and variables → Actions → New repository secret**:

- `API_URL` = URL do backend no Render
- `CRON_SECRET` = mesmo valor da variável no Render

O workflow roda a cada 5 minutos (`window_minutes=6` cobre atrasos da fila do GitHub) e
pode ser disparado à mão em **Actions → Lembretes de treino → Run workflow** para testar.
Ele também serve de "keep-alive": o primeiro request depois da hibernação leva ~50s, o que
o `--retry` do curl absorve.

## 6. Usar no celular

Abra a URL da Vercel no Chrome (Android) ou Safari (iOS 16.4+), use **Adicionar à tela de
início** e permita notificações. No iOS o push só funciona com o app instalado assim.

## Custos

Neon free, Render free (750h/mês), Vercel Hobby e GitHub Actions em repositório público são
gratuitos. Nada aqui exige cartão de crédito.
