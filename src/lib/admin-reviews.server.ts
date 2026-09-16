import { createServerFn } from "@tanstack/react-start";
import { eq, desc, asc, and, or, like, sql, isNotNull, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db.server";
import { requireAdminAuth } from "@/lib/auth.server";

// ─── Get all reviews with backend filtering & pagination (admin) ─────────────

const adminFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
  search: z.string().trim().max(100).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  product: z.string().trim().max(80).optional(),
  hasPhoto: z.boolean().optional(),
  sortBy: z
    .enum(["newest", "oldest", "rating_desc", "rating_asc"])
    .default("newest"),
});

export const adminGetAllReviews = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => adminFilterSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const db = getDb();
    const conditions = [];

    if (data.status !== "all") {
      conditions.push(
        eq(schema.reviews.status, data.status as "pending" | "approved" | "rejected")
      );
    }

    if (data.search) {
      const q = `%${data.search}%`;
      conditions.push(
        or(
          like(schema.reviews.name, q),
          like(schema.reviews.email, q),
          like(schema.reviews.phone, q),
          like(schema.reviews.product, q),
          like(schema.reviews.comment, q)
        )!
      );
    }

    if (data.rating && data.rating >= 1 && data.rating <= 5) {
      conditions.push(eq(schema.reviews.rating, data.rating));
    }

    if (data.product && data.product !== "all") {
      conditions.push(eq(schema.reviews.product, data.product));
    }

    if (data.hasPhoto === true) {
      conditions.push(
        and(
          isNotNull(schema.reviews.image_url),
          ne(schema.reviews.image_url, "")
        )!
      );
    } else if (data.hasPhoto === false) {
      conditions.push(
        or(
          isNull(schema.reviews.image_url),
          eq(schema.reviews.image_url, "")
        )!
      );
    }

    let orderByClause;
    switch (data.sortBy) {
      case "oldest":
        orderByClause = [asc(schema.reviews.created_at)];
        break;
      case "rating_desc":
        orderByClause = [desc(schema.reviews.rating), desc(schema.reviews.created_at)];
        break;
      case "rating_asc":
        orderByClause = [asc(schema.reviews.rating), desc(schema.reviews.created_at)];
        break;
      case "newest":
      default:
        orderByClause = [desc(schema.reviews.created_at)];
        break;
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const offset = (data.page - 1) * data.pageSize;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(schema.reviews)
        .where(whereClause)
        .orderBy(...orderByClause)
        .limit(data.pageSize)
        .offset(offset),
      db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(schema.reviews)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / data.pageSize));

    return {
      reviews: rows.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
      })),
      total,
      totalPages,
      page: data.page,
      pageSize: data.pageSize,
    };
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
