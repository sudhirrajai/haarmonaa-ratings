/**
 * src/lib/admin-auth.server.ts
 * Server functions for admin authentication using JWT cookies.
 */
import { createServerFn } from "@tanstack/react-start";
import { setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { loginAdmin, requireAdminAuth } from "@/lib/auth.server";

// ─── Login ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const result = await loginAdmin(data.email, data.password);
    if (!result) {
      throw new Error("Invalid email or password");
    }

    // Set httpOnly cookie directly on the server response
    setCookie("admin_token", result.token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env["NODE_ENV"] === "production",
    });

    return { success: true };
  });

// ─── Logout ───────────────────────────────────────────────────────────────────

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie("admin_token", { path: "/" });
  return { success: true };
});

// ─── Check session ────────────────────────────────────────────────────────────

export const checkAdminSession = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    return { adminId: context.adminId, authenticated: true };
  });
