-- Run this after the earlier migrations in an existing Supabase project.
-- It lets parsed receipts be saved before every item has been assigned.
alter table public.receipts add column if not exists is_complete boolean not null default true;

create or replace function public.save_receipt(p_receipt jsonb, p_expected_updated_at timestamptz default null) returns uuid language plpgsql set search_path = public as $$
declare v_receipt_id uuid := (p_receipt->>'id')::uuid; current_receipt public.receipts%rowtype; item_value jsonb; share_value jsonb; item_id uuid; item_index integer := 0;
begin
  if not public.is_app_member() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into current_receipt from public.receipts where id = v_receipt_id;
  if found and p_expected_updated_at is null then return v_receipt_id; end if;
  if found and current_receipt.updated_at <> p_expected_updated_at then raise exception 'This receipt changed elsewhere. Reload and try again.' using errcode = 'P0001'; end if;
  if not found and p_expected_updated_at is not null then raise exception 'Receipt not found.' using errcode = 'P0001'; end if;
  if found then
    update public.receipts set is_complete = coalesce((p_receipt->>'isComplete')::boolean, true), merchant = p_receipt->>'merchant', purchased_at = (p_receipt->>'purchasedAt')::date, payer_id = p_receipt->>'payerId', subtotal_cents = (p_receipt->>'subtotalCents')::integer, tax_cents = (p_receipt->>'taxCents')::integer, adjustment_cents = (p_receipt->>'adjustmentCents')::integer, total_cents = (p_receipt->>'totalCents')::integer, image_id = nullif(p_receipt->>'imageId', '')::uuid, updated_at = now() where id = v_receipt_id;
    delete from public.receipt_items where receipt_id = v_receipt_id;
  else
    insert into public.receipts (id, is_complete, merchant, purchased_at, payer_id, subtotal_cents, tax_cents, adjustment_cents, total_cents, image_id) values (v_receipt_id, coalesce((p_receipt->>'isComplete')::boolean, true), p_receipt->>'merchant', (p_receipt->>'purchasedAt')::date, p_receipt->>'payerId', (p_receipt->>'subtotalCents')::integer, (p_receipt->>'taxCents')::integer, (p_receipt->>'adjustmentCents')::integer, (p_receipt->>'totalCents')::integer, nullif(p_receipt->>'imageId', '')::uuid);
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

revoke all on function public.save_receipt(jsonb, timestamptz) from public;
grant execute on function public.save_receipt(jsonb, timestamptz) to service_role;
