import Link from "next/link";
import { TodoLists } from "@/components/todo-lists";
import { getTodoItems } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function ListPage() {
  const items = await getTodoItems(createSupabaseServerClient());
  return <main className="shell"><Link href="/" className="back">← Back to groceries</Link><div className="list-pagehead"><div><h1>Groceries list</h1><p className="muted">A shared checklist for each roommate.</p></div></div><TodoLists initial={items} /></main>;
}
