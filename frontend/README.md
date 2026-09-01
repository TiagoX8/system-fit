# Solo Leveling Fitness — Frontend

App React 19 + Vite + TypeScript com tema "Sistema" (Solo Leveling), autenticação via
[`auth-lite-react`](https://www.npmjs.com/package/auth-lite-react) e PWA com Web Push.

## Rodando

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://127.0.0.1:8000
npm run dev               # http://localhost:5173
npm run build             # tsc -b + vite build + service worker
npm run lint
```

## Estrutura

```
src/
  main.tsx      AuthProvider(apiUrl=VITE_API_URL) + BrowserRouter
  App.tsx       rotas protegidas por isAuthenticated
  api.ts        fetch com Authorization: Bearer
  push.ts       permissão, subscription e POST /push/subscribe
  sw.ts         service worker (precache + push + notificationclick)
  types.ts      tipos compartilhados
  index.css     tema escuro com painéis translúcidos do Sistema
  components/Layout.tsx
  pages/        Login, Dashboard, Workouts, Rewards, History
```

## Notificações

Após o login o app pede permissão, registra o service worker e envia a subscription
para a API. Web Push funciona em Android e desktop; no iOS exige iOS 16.4+ e o app
instalado na tela de início. Em desenvolvimento o service worker roda em `localhost`
(contexto seguro); em produção é obrigatório HTTPS.

Todo o visual é recriado com CSS — nenhum asset protegido por direitos autorais é usado.
