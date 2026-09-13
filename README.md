# Groceries

A shared receipt and balances app for Michael, Kevin, Feo, and Saketh. It runs as a Next.js app on Vercel, uses Supabase for Auth, Postgres, and private receipt-image Storage, and calls OpenAI only from a server route to read receipts.

## What is safe to commit

Commit the whole project, including [`.env.example`](.env.example) and the Supabase migration. Do **not** commit `.env.local`, OpenAI keys, Supabase service-role/secret keys, exported database backups, or Vercel project files. `.gitignore` already excludes `.env*` while retaining `.env.example`.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are intentionally browser-visible. The migration enables Row Level Security, so a publishable key cannot read the household data on its own. `OPENAI_API_KEY` is server-only and must stay in Vercel and `.env.local`.

## Set up Supabase

1. Create a new project in the [Supabase dashboard](https://supabase.com/dashboard). Keep its database password somewhere private; the application does not need it.
2. Open **SQL Editor**, create a new query, paste all of [`supabase/migrations/0001_household.sql`](supabase/migrations/0001_household.sql), and run it. This creates the tables, a private `receipt-images` bucket, transaction functions, and all Row Level Security policies.
3. Open **Project Settings → API**. Copy the Project URL and the **publishable** key. Do not copy a `service_role` or secret key into the app.
4. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` while developing. Add these Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - your eventual Vercel address followed by `/auth/callback`, for example `https://groceries-your-name.vercel.app/auth/callback`
5. In **Authentication → Providers → Email**, leave email sign-in enabled. The app sends passwordless sign-in links.
6. Start the app once, visit `/login`, and have each roommate request a link using the email they will use. Each account will see “Ask to be added.”
7. Back in the SQL Editor, first identify those accounts:

```sql
select id, email from auth.users order by created_at;
```

Then add the four accounts, replacing each UUID with the matching `id` from that query:

```sql
insert into public.app_members (user_id, display_name) values
  ('MICHAEL-USER-UUID', 'Michael'),
  ('KEVIN-USER-UUID', 'Kevin'),
  ('FEO-USER-UUID', 'Feo'),
  ('SAKETH-USER-UUID', 'Saketh');
```

Only members in this allow-list can read, upload, change, or delete household data. Add another person later with one more `insert` after they have signed in once.

## Run locally

1. Copy the example file in PowerShell:

```powershell
Copy-Item .env.example .env.local
```

2. Fill `.env.local` with the Supabase URL, publishable key, and your `OPENAI_API_KEY`. `RECEIPT_MODEL` is optional.
3. Install and start the app:

```powershell
npm install
npm run dev
```

4. Visit `http://localhost:3000`, sign in with an allow-listed email, and add a receipt. Manual entry works without an OpenAI key; automatic reading requires it.

## Publish with GitHub and Vercel

1. Create an empty public GitHub repository. From this folder, review the files and push the project:

```powershell
git status
git add .
git commit -m "Use Vercel and Supabase"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Before `git add`, confirm that `.env.local` is absent from `git status`. If a secret was ever committed, revoke it in its provider first, then remove it from Git history.

2. In Vercel, choose **New Project**, import that repository, accept the Next.js preset, and deploy. No Render account or Render API is needed.
3. Before the first production deployment, open **Project Settings → Environment Variables** and add these values for Production (and Preview if you want preview deployments to work):

| Name | Value | Sensitive? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key | No |
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `RECEIPT_MODEL` | `gpt-4.1-mini` or your preferred supported vision model | No |

4. Deploy, copy the production URL, then return to Supabase Authentication and add `https://YOUR-VERCEL-DOMAIN/auth/callback` to Redirect URLs. Set the Site URL to the same production URL. Redeploy if you changed Vercel environment variables.
5. Visit the production app, sign in, and add one manual receipt. Then test an image receipt with the OpenAI key set.

Vercel builds each push from the connected Git repository. Keep secrets only in Vercel Environment Variables and in your untracked local `.env.local` file.

## Checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

The Playwright browser suite is skipped until you provide a configured Supabase project and a signed-in test member. The old local SQLite file is no longer used; existing local-only receipts remain in `data/groceries.sqlite` and are not automatically copied to Supabase.
