/**
 * src/lib/auth.server.ts
 * Custom JWT-based admin authentication utilities.
 * ONLY import from server functions / server routes.
 */
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db.server";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "admin_token";
const TOKEN_EXPIRY = "7d";

function getJwtSecret(): Uint8Array {
  const secret = process.env["JWT_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET env var is missing or too short (need ≥32 chars).",
    );
  }
  return new TextEncoder().encode(secret);
}

// ─── Token operations ─────────────────────────────────────────────────────────

export async function signAdminToken(adminId: string): Promise<string> {
  return new SignJWT({ sub: adminId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyAdminToken(
  token: string,
): Promise<{ adminId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload['role'] !== "admin" || !payload.sub) return null;
    return { adminId: payload.sub };
  } catch {
    return null;
  }
}

// ─── Admin login ──────────────────────────────────────────────────────────────

export async function loginAdmin(
  email: string,
  password: string,
): Promise<{ token: string } | null> {
  const db = getDb();
  const [admin] = await db
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.email, email.toLowerCase().trim()))
    .limit(1);

  if (!admin) return null;
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return null;

  const token = await signAdminToken(admin.id);
  return { token };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * requireAdminAuth — use as middleware on protected server functions.
 * Reads the admin_token httpOnly cookie from the incoming request.
 */
export const requireAdminAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const token = getCookie(COOKIE_NAME);

    if (!token) {
      throw new Error("Unauthorized: No admin session");
    }

    const payload = await verifyAdminToken(token);
    if (!payload) {
      throw new Error("Unauthorized: Invalid or expired session");
    }

    return next({ context: { adminId: payload.adminId } });
  },
);

// ─── Password hashing (for seeding) ──────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
