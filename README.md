# Groceries

A shared receipt and balances app for Michael, Kevin, Feo, and Saketh. It runs on Vercel, stores data and private receipt images in Supabase, and calls OpenAI only from a server route to read receipts. There are no user accounts or email login.

## Secrets and public GitHub

Commit the project, [`.env.example`](.env.example), and the SQL migrations. Never commit `.env.local`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, database exports, or Vercel project files. `.gitignore` already excludes `.env*` while keeping `.env.example`.

All Supabase calls happen on the server. `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` must be set only in `.env.local` and Vercel Environment Variables. Do not create any `NEXT_PUBLIC_` variables for this app.

## Set up Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/migrations/0001_household.sql`](supabase/migrations/0001_household.sql).
3. If you already ran the earlier migration with email login, then also run [`supabase/migrations/0002_remove_email_auth.sql`](supabase/migrations/0002_remove_email_auth.sql). It makes the existing project work without user accounts.
4. Run [`supabase/migrations/0003_receipt_item_metadata.sql`](supabase/migrations/0003_receipt_item_metadata.sql). It adds the printed SKU/raw text, line discount, and uncertainty fields used by receipt reading.
5. Open **Project Settings → API**. Copy the Project URL and a **secret key**. Do not use the publishable key. The secret key is for the Next.js server only.

The migration keeps the Supabase tables and Storage bucket private. The Vercel server uses the secret key; browsers never contact Supabase directly.

## Run locally

1. Keep your current `.env.local` private. Change its old `NEXT_PUBLIC_SUPABASE_URL` entry to `SUPABASE_URL`.
2. Add your Supabase secret key as `SUPABASE_SECRET_KEY`. Keep your existing `OPENAI_API_KEY` line.
3. Use this shape, substituting your real values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_supabase_secret_key
OPENAI_API_KEY=your_openai_key
RECEIPT_MODEL=gpt-4.1-mini
```

4. Restart the app with:

```powershell
npm run dev
```

5. Open `http://localhost:3000`. Everyone with the site address can use the shared household app, so do not publish its URL outside the roommates.

## Deploy on Vercel

1. Push this repository to GitHub. Confirm `.env.local` does not appear in `git status` before committing.
2. In Vercel, select **New Project**, import the repository, accept the Next.js preset, and deploy. Render is not needed.
3. In **Project Settings → Environment Variables**, add these server-only values for Production and Preview:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SECRET_KEY` | Your Supabase secret key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `RECEIPT_MODEL` | Optional; `gpt-4.1-mini` is the default |

4. Redeploy after adding or changing environment variables.

If the app says receipt reading is not configured, `OPENAI_API_KEY` is missing from the Vercel environment used by that deployment. Add it as a **Sensitive** value for Production (and Preview when testing preview deployments), then redeploy. The key must be named exactly `OPENAI_API_KEY`; adding it only to `.env.local` configures your computer, not Vercel.

## Checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Set `RUN_E2E=1` only when you want the browser suite to create and delete test data in a dedicated Supabase project.
