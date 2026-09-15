import { NextResponse } from "next/server";
import { deleteTodoItem, updateTodoItem } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todoUpdateSchema } from "@/lib/validation";
import { z } from "zod";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await params).id);
    return NextResponse.json(await updateTodoItem(createSupabaseServerClient(), id, todoUpdateSchema.parse(await request.json())));
  } catch (error) { return apiError(error); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await deleteTodoItem(createSupabaseServerClient(), z.uuid().parse((await params).id));
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
