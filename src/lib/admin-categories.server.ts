import { createServerFn } from "@tanstack/react-start";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import * as crypto from "crypto";
import { getDb, schema } from "@/lib/db.server";
import { requireAdminAuth } from "@/lib/auth.server";

// ─── Get all categories (admin) ───────────────────────────────────────────────

export const adminGetCategories = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.sort_order), asc(schema.categories.name));
    return rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
  });

// ─── Add category ─────────────────────────────────────────────────────────────

const addSchema = z.object({ name: z.string().trim().min(1).max(80) });

export const addCategory = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => addSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    // Find max sort_order
    const all = await db.select({ sort_order: schema.categories.sort_order }).from(schema.categories);
    const nextOrder = all.length > 0 ? Math.max(...all.map((c) => c.sort_order)) + 1 : 1;
    const id = crypto.randomUUID();
    try {
      await db.insert(schema.categories).values({
        id,
        name: data.name,
        sort_order: nextOrder,
        is_active: true,
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === "ER_DUP_ENTRY") {
        throw new Error("That item already exists");
      }
      throw new Error("Could not add that item");
    }
    return { id };
  });

// ─── Toggle active ────────────────────────────────────────────────────────────

const toggleSchema = z.object({
  id: z.string().min(1),
  is_active: z.boolean(),
});

export const toggleCategory = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => toggleSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    await db
      .update(schema.categories)
      .set({ is_active: data.is_active })
      .where(eq(schema.categories.id, data.id));
    return { success: true };
  });

// ─── Delete category ──────────────────────────────────────────────────────────

const deleteSchema = z.object({ id: z.string().min(1) });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(schema.categories).where(eq(schema.categories.id, data.id));
    return { success: true };
  });

// ─── Public: Get active categories (for review form) ─────────────────────────

export const getActiveCategories = createServerFn({ method: "GET" }).handler(
  async () => {
    const db = getDb();
    const rows = await db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.is_active, true))
      .orderBy(asc(schema.categories.sort_order), asc(schema.categories.name));
    return rows;
  },
);
