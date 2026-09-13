import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./auth";
export function apiError(error: unknown, fallback = "Something went wrong.") {
  console.error(error);
  const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : fallback;
  const lowerMessage = message?.toLowerCase();
  const status = error instanceof ApiError ? error.status : lowerMessage?.includes("not found") ? 404 : lowerMessage?.includes("changed elsewhere") ? 409 : 400;
  return NextResponse.json({ error: message || fallback }, { status });
}
