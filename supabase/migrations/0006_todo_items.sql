-- Run this after the earlier migrations in an existing Supabase project.
create table if not exists public.todo_items (
  id uuid primary key,
  roommate_id text not null references public.roommates(id),
  text text not null check (char_length(btrim(text)) between 1 and 300),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists todo_items_roommate on public.todo_items (roommate_id, completed, created_at);

alter table public.todo_items enable row level security;
create policy "members can access todo items" on public.todo_items for all to authenticated using (public.is_app_member()) with check (public.is_app_member());
