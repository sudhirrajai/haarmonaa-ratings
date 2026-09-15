// Supabase has been removed from this project.
// This file is kept as a stub to avoid import errors from any legacy references.
import { createMiddleware } from "@tanstack/react-start";

/** No-op middleware — Supabase auth replaced by custom JWT (src/lib/auth.server.ts) */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => next(),
);

export {};
