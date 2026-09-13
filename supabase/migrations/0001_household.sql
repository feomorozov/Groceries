create table if not exists public.roommates (id text primary key check (id in ('michael', 'kevin', 'feo', 'saketh')), name text not null unique);
insert into public.roommates (id, name) values ('michael', 'Michael'), ('kevin', 'Kevin'), ('feo', 'Feo'), ('saketh', 'Saketh') on conflict (id) do update set name = excluded.name;
create table if not exists public.app_members (user_id uuid primary key references auth.users(id) on delete cascade, display_name text not null, created_at timestamptz not null default now());
create table if not exists public.receipt_images (id uuid primary key, object_path text not null unique, mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')), created_at timestamptz not null default now());
create table if not exists public.receipts (id uuid primary key, merchant text not null, purchased_at date not null, payer_id text not null references public.roommates(id), subtotal_cents integer not null, tax_cents integer not null, adjustment_cents integer not null, total_cents integer not null, image_id uuid references public.receipt_images(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.receipt_items (id uuid primary key, receipt_id uuid not null references public.receipts(id) on delete cascade, sku text, raw_description text, description text not null, quantity text, unit_price_cents integer, item_discount_cents integer, line_total_cents integer not null, is_uncertain boolean not null default false, sort_order integer not null);
create table if not exists public.item_shares (receipt_item_id uuid not null references public.receipt_items(id) on delete cascade, roommate_id text not null references public.roommates(id), allocated_cents integer not null, primary key (receipt_item_id, roommate_id));
create index if not exists receipts_date on public.receipts (purchased_at desc, created_at desc);
create index if not exists items_receipt on public.receipt_items (receipt_id, sort_order);

create or replace function public.is_app_member() returns boolean language sql stable security definer set search_path = public as $$ select auth.role() = 'service_role' or exists (select 1 from public.app_members where user_id = auth.uid()); $$;
alter table public.roommates enable row level security;
alter table public.app_members enable row level security;
alter table public.receipt_images enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.item_shares enable row level security;
create policy "members can read roommates" on public.roommates for select to authenticated using (public.is_app_member());
create policy "members can read themselves" on public.app_members for select to authenticated using (user_id = auth.uid());
create policy "members can access images" on public.receipt_images for all to authenticated using (public.is_app_member()) with check (public.is_app_member());
create policy "members can access receipts" on public.receipts for all to authenticated using (public.is_app_member()) with check (public.is_app_member());
create policy "members can access items" on public.receipt_items for all to authenticated using (public.is_app_member()) with check (public.is_app_member());
create policy "members can access shares" on public.item_shares for all to authenticated using (public.is_app_member()) with check (public.is_app_member());
insert into storage.buckets (id, name, public) values ('receipt-images', 'receipt-images', false) on conflict (id) do update set public = false;
create policy "members can access receipt files" on storage.objects for all to authenticated using (bucket_id = 'receipt-images' and public.is_app_member()) with check (bucket_id = 'receipt-images' and public.is_app_member());

create or replace function public.save_receipt(p_receipt jsonb, p_expected_updated_at timestamptz default null) returns uuid language plpgsql set search_path = public as $$
declare v_receipt_id uuid := (p_receipt->>'id')::uuid; current_receipt public.receipts%rowtype; item_value jsonb; share_value jsonb; item_id uuid; item_index integer := 0;
begin
  if not public.is_app_member() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into current_receipt from public.receipts where id = v_receipt_id;
  if found and p_expected_updated_at is null then return v_receipt_id; end if;
  if found and current_receipt.updated_at <> p_expected_updated_at then raise exception 'This receipt changed elsewhere. Reload and try again.' using errcode = 'P0001'; end if;
  if not found and p_expected_updated_at is not null then raise exception 'Receipt not found.' using errcode = 'P0001'; end if;
  if found then
    update public.receipts set merchant = p_receipt->>'merchant', purchased_at = (p_receipt->>'purchasedAt')::date, payer_id = p_receipt->>'payerId', subtotal_cents = (p_receipt->>'subtotalCents')::integer, tax_cents = (p_receipt->>'taxCents')::integer, adjustment_cents = (p_receipt->>'adjustmentCents')::integer, total_cents = (p_receipt->>'totalCents')::integer, image_id = nullif(p_receipt->>'imageId', '')::uuid, updated_at = now() where id = v_receipt_id;
    delete from public.receipt_items where receipt_id = v_receipt_id;
  else
    insert into public.receipts (id, merchant, purchased_at, payer_id, subtotal_cents, tax_cents, adjustment_cents, total_cents, image_id) values (v_receipt_id, p_receipt->>'merchant', (p_receipt->>'purchasedAt')::date, p_receipt->>'payerId', (p_receipt->>'subtotalCents')::integer, (p_receipt->>'taxCents')::integer, (p_receipt->>'adjustmentCents')::integer, (p_receipt->>'totalCents')::integer, nullif(p_receipt->>'imageId', '')::uuid);
  end if;
  for item_value in select value from jsonb_array_elements(coalesce(p_receipt->'items', '[]'::jsonb)) loop
    item_id := (item_value->>'id')::uuid;
    insert into public.receipt_items (id, receipt_id, sku, raw_description, description, quantity, unit_price_cents, item_discount_cents, line_total_cents, is_uncertain, sort_order) values (item_id, v_receipt_id, nullif(item_value->>'sku', ''), nullif(item_value->>'rawDescription', ''), item_value->>'description', nullif(item_value->>'quantity', ''), nullif(item_value->>'unitPriceCents', '')::integer, nullif(item_value->>'itemDiscountCents', '')::integer, (item_value->>'lineTotalCents')::integer, coalesce((item_value->>'isUncertain')::boolean, false), item_index);
    for share_value in select value from jsonb_array_elements(coalesce(item_value->'shares', '[]'::jsonb)) loop
      insert into public.item_shares (receipt_item_id, roommate_id, allocated_cents) values (item_id, share_value->>'roommateId', (share_value->>'allocatedCents')::integer);
    end loop;
    item_index := item_index + 1;
  end loop;
  return v_receipt_id;
end; $$;
create or replace function public.delete_receipt(p_id uuid, p_expected_updated_at timestamptz) returns text language plpgsql set search_path = public as $$
declare object_path_value text;
begin
  if not public.is_app_member() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select i.object_path into object_path_value from public.receipts r left join public.receipt_images i on i.id = r.image_id where r.id = p_id;
  if not found then raise exception 'Receipt not found.' using errcode = 'P0001'; end if;
  delete from public.receipts where id = p_id and updated_at = p_expected_updated_at;
  if not found then raise exception 'This receipt changed elsewhere. Reload and try again.' using errcode = 'P0001'; end if;
  return object_path_value;
end; $$;
revoke all on function public.save_receipt(jsonb, timestamptz) from public;
revoke all on function public.delete_receipt(uuid, timestamptz) from public;
grant execute on function public.save_receipt(jsonb, timestamptz) to service_role;
grant execute on function public.delete_receipt(uuid, timestamptz) to service_role;
