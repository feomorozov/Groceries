# Groceries

A small, persistent receipt and balance tracker for the roomates

## Run locally

Requires Node.js 22.16 or newer (the app uses Node's built-in SQLite module).

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Manual receipt entry works immediately. To read receipt images automatically, set `OPENAI_API_KEY` in `.env.local`. `RECEIPT_MODEL` can override the default vision-capable model. API credentials are only read by the server.

Receipt images and normalized receipt data are stored in `data/groceries.sqlite`. Set `DATABASE_PATH` to an absolute path on a persistent volume for deployment. This SQLite setup is suited to one long-running Node server; a multi-instance deployment should replace `src/lib/db.ts` with a shared PostgreSQL implementation.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The browser suite runs against the production build, so run `npm run build` first.
