import { createServerFn } from "@tanstack/react-start";
import { eq, desc, asc, and, or, like, sql, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";
import * as crypto from "crypto";
import { getDb, schema } from "@/lib/db.server";

// ─── Fetch approved reviews with filtering & pagination (public) ─────────────

const publicReviewsFilterSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(50).default(8),
    search: z.string().trim().max(100).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    product: z.string().trim().max(80).optional(),
    hasPhoto: z.boolean().optional(),
    sortBy: z
      .enum(["newest", "oldest", "highest_rating", "lowest_rating"])
      .default("newest"),
    // Backward compatibility for existing limit/offset callers
    limit: z.number().int().min(1).max(50).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .optional();

export const getApprovedReviews = createServerFn({ method: "GET" })
  .validator((d: unknown) => publicReviewsFilterSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = getDb();

    // Determine pagination
    const pageSize = data?.pageSize ?? data?.limit ?? 8;
    const page =
      data?.page ??
      (data?.offset != null && data?.limit
        ? Math.floor(data.offset / data.limit) + 1
        : 1);
    const offset = data?.offset ?? (page - 1) * pageSize;

    // Build filter conditions
    const conditions = [eq(schema.reviews.status, "approved")];

    if (data?.search) {
      const q = `%${data.search}%`;
      conditions.push(
        or(
          like(schema.reviews.name, q),
          like(schema.reviews.comment, q),
          like(schema.reviews.product, q)
        )!
      );
    }

    if (data?.rating && data.rating >= 1 && data.rating <= 5) {
      conditions.push(eq(schema.reviews.rating, data.rating));
    }

    if (data?.product && data.product !== "all") {
      conditions.push(eq(schema.reviews.product, data.product));
    }

    if (data?.hasPhoto) {
      conditions.push(
        and(
          isNotNull(schema.reviews.image_url),
          ne(schema.reviews.image_url, "")
        )!
      );
    }

    // Determine sort order
    let orderByClause;
    switch (data?.sortBy) {
      case "oldest":
        orderByClause = [asc(schema.reviews.created_at)];
        break;
      case "highest_rating":
        orderByClause = [desc(schema.reviews.rating), desc(schema.reviews.created_at)];
        break;
      case "lowest_rating":
        orderByClause = [asc(schema.reviews.rating), desc(schema.reviews.created_at)];
        break;
      case "newest":
      default:
        orderByClause = [desc(schema.reviews.created_at)];
        break;
    }

    const whereCondition = and(...conditions);

    const [rows, filteredCountResult, overallStats] = await Promise.all([
      db
        .select({
          id: schema.reviews.id,
          name: schema.reviews.name,
          product: schema.reviews.product,
          rating: schema.reviews.rating,
          comment: schema.reviews.comment,
          image_url: schema.reviews.image_url,
          created_at: schema.reviews.created_at,
        })
        .from(schema.reviews)
        .where(whereCondition)
        .orderBy(...orderByClause)
        .limit(pageSize)
        .offset(offset),
      db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(schema.reviews)
        .where(whereCondition),
      db
        .select({
          count: sql<number>`count(*)`,
          avgRating: sql<number>`coalesce(avg(${schema.reviews.rating}), 0)`,
        })
        .from(schema.reviews)
        .where(eq(schema.reviews.status, "approved")),
    ]);

    const total = Number(filteredCountResult[0]?.count ?? 0);
    const overallTotal = Number(overallStats[0]?.count ?? 0);
    const avg = Number(overallStats[0]?.avgRating ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      reviews: rows.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
        photo: r.image_url ?? null,
      })),
      total,
      overallTotal,
      totalPages,
      page,
      pageSize,
      average: Math.round(avg * 10) / 10,
      hasMore: page < totalPages,
    };
  });

// ─── Submit a review (public) ─────────────────────────────────────────────────

const submitSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).nullish(),
  product: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000),
  image_url: z.string().max(500).nullish(),
});

import { isAutoApproveEnabled } from "./admin-settings.server";

export const submitReview = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    const id = crypto.randomUUID();
    const autoApprove = await isAutoApproveEnabled();

    await db.insert(schema.reviews).values({
      id,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      product: data.product,
      rating: data.rating,
      comment: data.comment,
      image_url: data.image_url ?? null,
      status: autoApprove ? "approved" : "pending",
    });

    return {
      id,
      status: autoApprove ? "approved" : "pending",
      message: autoApprove
        ? "Thank you! Your review has been published."
        : "Thank you! Your review has been submitted and will appear after approval.",
    };
  });
