import { createServerFn } from "@tanstack/react-start";
import { eq, desc, asc, and, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db.server";
import { requireAdminAuth } from "@/lib/auth.server";

// ─── Get all reviews (admin) ──────────────────────────────────────────────────

const filterSchema = z.object({
  status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
});

export const adminGetAllReviews = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const db = getDb();
    const conditions =
      data.status !== "all"
        ? [eq(schema.reviews.status, data.status as "pending" | "approved" | "rejected")]
        : [];

    const rows = await db
      .select()
      .from(schema.reviews)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.reviews.created_at));

    return rows.map((r) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    }));
  });

// ─── Approve a review ─────────────────────────────────────────────────────────

const idSchema = z.object({ id: z.string().min(1) });

export const approveReview = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    await db
      .update(schema.reviews)
      .set({ status: "approved" })
      .where(eq(schema.reviews.id, data.id));
    return { success: true };
  });

// ─── Approve all pending reviews ─────────────────────────────────────────────

export const approveAllPending = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const db = getDb();
    await db
      .update(schema.reviews)
      .set({ status: "approved" })
      .where(eq(schema.reviews.status, "pending"));
    return { success: true };
  });

// ─── Reject a review ──────────────────────────────────────────────────────────

export const rejectReview = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    await db
      .update(schema.reviews)
      .set({ status: "rejected" })
      .where(eq(schema.reviews.id, data.id));
    return { success: true };
  });

// ─── Edit a review (comment + rating) ────────────────────────────────────────

const editSchema = z.object({
  id: z.string().min(1),
  comment: z.string().trim().min(1).max(1000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  product: z.string().trim().min(1).max(80).optional(),
});

export const editReview = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => editSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) {
      throw new Error("No fields to update");
    }
    await db
      .update(schema.reviews)
      .set(fields)
      .where(eq(schema.reviews.id, id));
    return { success: true };
  });

// ─── Delete a review ──────────────────────────────────────────────────────────

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    await db
      .delete(schema.reviews)
      .where(eq(schema.reviews.id, data.id));
    return { success: true };
  });

// ─── Review stats ─────────────────────────────────────────────────────────────

export const getReviewStats = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const db = getDb();
    const all = await db
      .select({
        status: schema.reviews.status,
        rating: schema.reviews.rating,
      })
      .from(schema.reviews);

    const total = all.length;
    const pending = all.filter((r) => r.status === "pending").length;
    const approved = all.filter((r) => r.status === "approved").length;
    const rejected = all.filter((r) => r.status === "rejected").length;
    const avgRating =
      approved > 0
        ? all
            .filter((r) => r.status === "approved")
            .reduce((s, r) => s + r.rating, 0) / approved
        : 0;

    return { total, pending, approved, rejected, avgRating };
  });
