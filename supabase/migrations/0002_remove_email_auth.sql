-- Run this after 0001_household.sql when converting an existing project.
-- The app now uses only the server-side Supabase secret key; browser users do not sign in.
alter table public.receipt_images alter column uploaded_by drop not null;
alter table public.receipt_images alter column uploaded_by drop default;

create or replace function public.is_app_member()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.role() = 'service_role' or exists (select 1 from public.app_members where user_id = auth.uid());
$$;

revoke all on function public.save_receipt(jsonb, timestamptz) from public;
revoke all on function public.delete_receipt(uuid, timestamptz) from public;
grant execute on function public.save_receipt(jsonb, timestamptz) to service_role;
grant execute on function public.delete_receipt(uuid, timestamptz) to service_role;
