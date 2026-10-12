-- Run this after the earlier migrations in an existing Supabase project.
-- Receipts saved before incomplete-receipt support may be marked complete even when they have no assignments.
alter table public.receipts add column if not exists is_complete boolean not null default true;

update public.receipts as receipt
set is_complete = false, updated_at = now()
where receipt.is_complete
  and (
    not exists (select 1 from public.receipt_items as item where item.receipt_id = receipt.id)
    or exists (
      select 1
      from public.receipt_items as item
      where item.receipt_id = receipt.id
        and not exists (select 1 from public.item_shares as share where share.receipt_item_id = item.id)
    )
  );
