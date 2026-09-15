import { NextResponse } from "next/server";
import { createTodoItem, getTodoItems } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todoCreateSchema } from "@/lib/validation";

export async function GET() {
  try { return NextResponse.json(await getTodoItems(createSupabaseServerClient())); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try { return NextResponse.json(await createTodoItem(createSupabaseServerClient(), todoCreateSchema.parse(await request.json())), { status: 201 }); }
  catch (error) { return apiError(error); }
}
