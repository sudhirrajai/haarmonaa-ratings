// Supabase has been removed from this project.
// This file is kept as a stub to avoid import errors from any legacy references.
import { createMiddleware } from "@tanstack/react-start";

/** No-op — Supabase auth replaced by custom JWT cookie */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => next({}),
);

export {};
